import supabase from '../lib/supabase';
import type { ProfitabilityReport } from '../types';

const reportMoneyFields = ['revenue', 'cogs', 'gross_profit', 'operating_expenses', 'net_profit', 'coverage_percent'] as const;

export async function getProfitabilityReport(dateFrom: string, dateTo: string): Promise<ProfitabilityReport> {
  const { data, error } = await supabase.rpc('get_profitability_report', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) throw error;
  const report = { ...(data as ProfitabilityReport) };
  reportMoneyFields.forEach((field) => { report[field] = Number(report[field]); });
  report.items = (report.items ?? []).map((row) => ({
    ...row,
    revenue: Number(row.revenue), cogs: Number(row.cogs), gross_profit: Number(row.gross_profit),
    sale_count: Number(row.sale_count), unresolved_count: Number(row.unresolved_count),
  }));
  report.days = (report.days ?? []).map((row) => ({
    ...row,
    revenue: Number(row.revenue), cogs: Number(row.cogs), gross_profit: Number(row.gross_profit),
    unresolved_count: Number(row.unresolved_count),
  }));
  return report;
}
