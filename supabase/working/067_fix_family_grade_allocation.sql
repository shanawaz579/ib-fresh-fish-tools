-- Keep fractional recent-grade shares when allocating grade-unknown family history.
CREATE OR REPLACE FUNCTION working.generate_harvest_forecast(p_start_date DATE DEFAULT CURRENT_DATE + 1)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  v_run_id BIGINT;
  v_target_date DATE;
  v_variant RECORD;
  v_values NUMERIC[];
  v_baseline NUMERIC;
  v_deviation NUMERIC;
  v_nonzero_weeks INTEGER;
  v_multiplier NUMERIC;
  v_recommended INTEGER;
  v_low INTEGER;
  v_high INTEGER;
  v_confidence NUMERIC;
  v_confidence_label TEXT;
  v_family_share NUMERIC;
  v_family_grade_codes TEXT[];
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can generate a harvest forecast' USING ERRCODE = '42501';
  END IF;

  IF p_start_date < CURRENT_DATE - 1 THEN
    RAISE EXCEPTION 'Forecast start date cannot be in the past';
  END IF;

  INSERT INTO working.forecast_runs (start_date, end_date, generated_by)
  VALUES (p_start_date, p_start_date + 6, auth.uid())
  ON CONFLICT (start_date) DO UPDATE
    SET end_date = EXCLUDED.end_date,
        model_version = 'weekday-v1',
        status = 'ready',
        generated_at = NOW(),
        generated_by = auth.uid()
  RETURNING id INTO v_run_id;

  FOR v_target_date IN SELECT generate_series(p_start_date, p_start_date + 6, '1 day')::DATE LOOP
    SELECT coalesce(event.demand_multiplier, 1)
      INTO v_multiplier
    FROM (SELECT 1) anchor
    LEFT JOIN working.forecast_calendar_events event
      ON event.event_date = v_target_date AND event.is_confirmed;

    FOR v_variant IN
      SELECT variant.id, variant.item_id, grade.code AS grade_code, variant.name
      FROM working.item_variants variant
      JOIN working.item_grades grade ON grade.id = variant.grade_id
      WHERE variant.is_active AND grade.is_active
      ORDER BY variant.id
    LOOP
      SELECT family_grade_codes INTO v_family_grade_codes
      FROM working.forecast_training_sales
      WHERE mapping_level = 'item' AND item_id = v_variant.item_id
      LIMIT 1;

      IF v_family_grade_codes IS NULL OR NOT (v_variant.grade_code = ANY(v_family_grade_codes)) THEN
        v_family_share := NULL;
      ELSE
        SELECT coalesce(
          (sum(training.quantity_crates) FILTER (WHERE training.item_variant_id = v_variant.id))::NUMERIC
            / nullif(sum(training.quantity_crates), 0),
          1::NUMERIC / greatest(count(DISTINCT allowed_variant.id), 1)
        )
        INTO v_family_share
        FROM working.item_variants allowed_variant
        JOIN working.item_grades allowed_grade ON allowed_grade.id = allowed_variant.grade_id
        LEFT JOIN working.forecast_training_sales training
          ON training.source_system = 'current'
         AND training.mapping_level = 'variant'
         AND training.item_variant_id = allowed_variant.id
         AND training.sale_date >= v_target_date - 56
         AND training.sale_date < v_target_date
        WHERE allowed_variant.item_id = v_variant.item_id
          AND allowed_variant.is_active
          AND allowed_grade.code = ANY(v_family_grade_codes);
      END IF;

      -- Eight matching weekdays. The generated dates preserve zero-demand weeks.
      SELECT array_agg(coalesce(day_quantity, 0) ORDER BY prior_date)
      INTO v_values
      FROM (
        SELECT prior_date,
          coalesce((
            SELECT sum(
              CASE
                WHEN training.mapping_level = 'variant' AND training.item_variant_id = v_variant.id
                  THEN training.quantity_crates
                WHEN training.mapping_level = 'item'
                  AND training.item_id = v_variant.item_id
                  AND (training.family_grade_codes IS NULL OR v_variant.grade_code = ANY(training.family_grade_codes))
                  THEN training.quantity_crates * coalesce(v_family_share, 0)
                ELSE 0
              END
            )
            FROM working.forecast_training_sales training
            WHERE training.sale_date = prior_date
          ), 0) AS day_quantity
        FROM generate_series(v_target_date - 56, v_target_date - 7, '7 days') prior(prior_date)
      ) history;

      SELECT coalesce(avg(value), 0), coalesce(stddev_pop(value), 0), count(*) FILTER (WHERE value > 0)
      INTO v_baseline, v_deviation, v_nonzero_weeks
      FROM unnest(v_values) value;

      v_baseline := v_baseline * v_multiplier;
      v_recommended := greatest(0, round(v_baseline)::INTEGER);
      v_low := greatest(0, floor((v_baseline - (0.75 * v_deviation)))::INTEGER);
      v_high := greatest(v_recommended, ceil(v_baseline + (0.75 * v_deviation))::INTEGER);
      v_confidence := least(1, greatest(0,
        (v_nonzero_weeks::NUMERIC / 8) *
        CASE WHEN v_baseline <= 0 THEN 0 ELSE 1 / (1 + (v_deviation / v_baseline)) END
      ));
      v_confidence_label := CASE
        WHEN v_confidence >= 0.65 THEN 'high'
        WHEN v_confidence >= 0.35 THEN 'medium'
        ELSE 'low'
      END;

      IF v_recommended > 0 OR EXISTS (
        SELECT 1 FROM working.forecast_recommendations existing
        WHERE existing.run_id = v_run_id
          AND existing.forecast_date = v_target_date
          AND existing.item_variant_id = v_variant.id
          AND existing.is_overridden
      ) THEN
        INSERT INTO working.forecast_recommendations (
          run_id, forecast_date, item_variant_id, baseline_crates,
          recommended_crates, low_crates, high_crates, final_crates,
          confidence_score, confidence_label, reasons
        ) VALUES (
          v_run_id, v_target_date, v_variant.id, round(v_baseline, 2),
          v_recommended, v_low, v_high, v_recommended,
          round(v_confidence, 4), v_confidence_label,
          jsonb_build_array(
            'Based on the last 8 matching weekdays',
            CASE WHEN v_multiplier <> 1 THEN 'Confirmed calendar adjustment applied' ELSE 'Includes recorded customer demand' END,
            CASE WHEN v_family_share IS NOT NULL THEN 'Grade-unknown history allocated using current grade mix' ELSE 'Item and grade history matched' END
          )
        )
        ON CONFLICT (run_id, forecast_date, item_variant_id) DO UPDATE
          SET baseline_crates = EXCLUDED.baseline_crates,
              recommended_crates = EXCLUDED.recommended_crates,
              low_crates = EXCLUDED.low_crates,
              high_crates = EXCLUDED.high_crates,
              final_crates = CASE WHEN working.forecast_recommendations.is_overridden
                THEN working.forecast_recommendations.final_crates ELSE EXCLUDED.final_crates END,
              confidence_score = EXCLUDED.confidence_score,
              confidence_label = EXCLUDED.confidence_label,
              reasons = EXCLUDED.reasons;
      ELSE
        DELETE FROM working.forecast_recommendations existing
        WHERE existing.run_id = v_run_id
          AND existing.forecast_date = v_target_date
          AND existing.item_variant_id = v_variant.id
          AND NOT existing.is_overridden;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_run_id;
END;
$$;
