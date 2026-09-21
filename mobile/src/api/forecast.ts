import supabase from '../lib/supabase';

export type HarvestForecastRow = {
  id: number;
  run_id: number;
  start_date: string;
  forecast_date: string;
  item_variant_id: number;
  item_name: string;
  grade_code: string;
  variant_name: string;
  baseline_crates: number;
  recommended_crates: number;
  low_crates: number;
  high_crates: number;
  final_crates: number;
  confidence_score: number;
  confidence_label: 'low' | 'medium' | 'high';
  reasons: string[];
  is_overridden: boolean;
  override_note: string | null;
  generated_at: string;
  model_name: 'weekday_average' | 'weekday_weighted';
  model_accuracy: number | null;
  run_status: 'ready' | 'approved' | 'archived';
  approved_at: string | null;
};

export type CustomerHarvestForecastRow = {
  id: number;
  run_id: number;
  start_date: string;
  forecast_date: string;
  customer_id: number;
  customer_name: string;
  customer_location: string | null;
  item_variant_id: number;
  variant_name: string;
  recommended_crates: number;
  low_crates: number;
  high_crates: number;
  confidence_score: number;
  confidence_label: 'low' | 'medium' | 'high';
};

export type HarvestForecastPlan = {
  items: HarvestForecastRow[];
  customers: CustomerHarvestForecastRow[];
  accuracy: ForecastAccuracyRow[];
};

export type ForecastAccuracyRow = {
  recommendation_id: number;
  run_id: number;
  forecast_date: string;
  item_variant_id: number;
  variant_name: string;
  recommended_crates: number;
  final_crates: number;
  actual_crates: number;
  model_absolute_error: number;
  plan_absolute_error: number;
  plan_accuracy: number;
  is_overridden: boolean;
};

function normalizeRow(row: Record<string, unknown>): HarvestForecastRow {
  return {
    ...(row as unknown as HarvestForecastRow),
    id: Number(row.id),
    run_id: Number(row.run_id),
    item_variant_id: Number(row.item_variant_id),
    baseline_crates: Number(row.baseline_crates),
    recommended_crates: Number(row.recommended_crates),
    low_crates: Number(row.low_crates),
    high_crates: Number(row.high_crates),
    final_crates: Number(row.final_crates),
    confidence_score: Number(row.confidence_score),
    model_accuracy: row.model_accuracy === null || row.model_accuracy === undefined ? null : Number(row.model_accuracy),
    reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
  };
}

async function getPlanRows(runId: number): Promise<HarvestForecastRow[]> {
  const { data, error } = await supabase
    .from('harvest_forecast_plan')
    .select('*')
    .eq('run_id', runId)
    .order('forecast_date')
    .order('item_name')
    .order('grade_code');
  if (error) throw error;
  return (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>));
}

async function getCustomerPlanRows(runId: number): Promise<CustomerHarvestForecastRow[]> {
  const { data, error } = await supabase
    .from('harvest_customer_forecast_plan')
    .select('*')
    .eq('run_id', runId)
    .order('forecast_date')
    .order('recommended_crates', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as unknown as CustomerHarvestForecastRow),
    id: Number(row.id),
    run_id: Number(row.run_id),
    customer_id: Number(row.customer_id),
    item_variant_id: Number(row.item_variant_id),
    recommended_crates: Number(row.recommended_crates),
    low_crates: Number(row.low_crates),
    high_crates: Number(row.high_crates),
    confidence_score: Number(row.confidence_score),
  }));
}

async function getAccuracyRows(): Promise<ForecastAccuracyRow[]> {
  const { data, error } = await supabase
    .from('forecast_actual_comparison')
    .select('*')
    .order('forecast_date', { ascending: false })
    .order('actual_crates', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as unknown as ForecastAccuracyRow),
    recommendation_id: Number(row.recommendation_id),
    run_id: Number(row.run_id),
    item_variant_id: Number(row.item_variant_id),
    recommended_crates: Number(row.recommended_crates),
    final_crates: Number(row.final_crates),
    actual_crates: Number(row.actual_crates),
    model_absolute_error: Number(row.model_absolute_error),
    plan_absolute_error: Number(row.plan_absolute_error),
    plan_accuracy: Number(row.plan_accuracy),
  }));
}

export async function getHarvestForecast(startDate: string, refresh = false): Promise<HarvestForecastPlan> {
  let runId: number | null = null;
  if (!refresh) {
    const { data, error } = await supabase.from('forecast_runs').select('id,status').eq('start_date', startDate).maybeSingle();
    if (error) throw error;
    runId = data ? Number(data.id) : null;
  }

  if (runId === null) {
    if (refresh) {
      const { error: evaluationError } = await supabase.rpc('refresh_forecast_model_performance');
      if (evaluationError) throw evaluationError;
    }
    const { data, error } = await supabase.rpc('generate_harvest_forecast_v2', { p_start_date: startDate });
    if (error) throw error;
    runId = Number(data);
  }

  let customers = refresh ? [] : await getCustomerPlanRows(runId);
  if (refresh || customers.length === 0) {
    const { error } = await supabase.rpc('generate_customer_harvest_forecast_v2', { p_run_id: runId });
    if (error) throw error;
    customers = await getCustomerPlanRows(runId);
  }
  return { items: await getPlanRows(runId), customers, accuracy: await getAccuracyRows() };
}

export async function saveHarvestForecastQuantity(id: number, crates: number): Promise<void> {
  const { data, error } = await supabase.rpc('set_harvest_forecast_quantity', {
    p_recommendation_id: id,
    p_final_crates: crates,
    p_note: 'Proprietor planning adjustment',
  });
  if (error) throw error;
  if (!data) throw new Error('Forecast adjustment was not saved');
}

export async function setHarvestForecastApproval(runId: number, approved: boolean): Promise<void> {
  const { data, error } = await supabase.rpc(approved ? 'approve_harvest_forecast' : 'reopen_harvest_forecast', {
    p_run_id: runId,
    p_note: approved ? 'Approved from harvest planning screen' : 'Reopened from harvest planning screen',
  });
  if (error) throw error;
  if (!data) throw new Error(approved ? 'Plan was not approved' : 'Plan was not reopened');
}
