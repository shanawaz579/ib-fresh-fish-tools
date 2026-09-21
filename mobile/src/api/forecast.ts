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

export async function getHarvestForecast(startDate: string, refresh = false): Promise<HarvestForecastPlan> {
  let runId: number | null = null;
  if (!refresh) {
    const { data, error } = await supabase.from('forecast_runs').select('id').eq('start_date', startDate).maybeSingle();
    if (error) throw error;
    runId = data ? Number(data.id) : null;
  }

  if (runId === null) {
    const { data, error } = await supabase.rpc('generate_harvest_forecast', { p_start_date: startDate });
    if (error) throw error;
    runId = Number(data);
  }

  let customers = refresh ? [] : await getCustomerPlanRows(runId);
  if (refresh || customers.length === 0) {
    const { error } = await supabase.rpc('generate_customer_harvest_forecast', { p_run_id: runId });
    if (error) throw error;
    customers = await getCustomerPlanRows(runId);
  }
  return { items: await getPlanRows(runId), customers };
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
