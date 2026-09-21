import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const environmentPath = process.env.LEGACY_ENV_FILE || path.join(projectRoot, '.env.local');
const environment = readEnvironment(environmentPath);
const url = process.env.LEGACY_SUPABASE_URL || environment.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.LEGACY_SUPABASE_KEY || environment.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Set LEGACY_SUPABASE_URL and LEGACY_SUPABASE_KEY, or provide LEGACY_ENV_FILE.');
}

const client = createClient(url, key, { auth: { persistSession: false } });
const [sales, customers, items] = await Promise.all([
  readAll('sales', 'id,customer_id,fish_variety_id,quantity_crates,quantity_kg,sale_date'),
  readAll('customers', 'id,name'),
  readAll('fish_varieties', 'id,name'),
]);

const customerIds = new Set(customers.map(row => row.id));
const itemIds = new Set(items.map(row => row.id));
const dates = [...new Set(sales.map(row => row.sale_date))].sort();
const normalizedCustomerGroups = groupBy(customers, row => normalizeName(row.name));
const crateRows = sales.filter(row => Number(row.quantity_crates) > 0);
const kgOnlyRows = sales.filter(row => Number(row.quantity_crates) === 0 && Number(row.quantity_kg) > 0);

const report = {
  generatedAt: new Date().toISOString(),
  sourceProject: new URL(url).hostname.split('.')[0],
  dateRange: { start: dates[0] ?? null, end: dates.at(-1) ?? null },
  sales: {
    rows: sales.length,
    daysWithSales: dates.length,
    crateRows: crateRows.length,
    kgOnlyRowsExcludedFromForecast: kgOnlyRows.length,
    zeroQuantityRows: sales.filter(row => Number(row.quantity_crates) === 0 && Number(row.quantity_kg) === 0).length,
    negativeQuantityRows: sales.filter(row => Number(row.quantity_crates) < 0 || Number(row.quantity_kg) < 0).length,
  },
  customers: {
    masterRows: customers.length,
    used: new Set(sales.map(row => row.customer_id)).size,
    normalizedDuplicateGroups: [...normalizedCustomerGroups.values()]
      .filter(group => group.length > 1)
      .map(group => group.map(row => ({ id: row.id, name: row.name }))),
    missingReferences: sales.filter(row => !customerIds.has(row.customer_id)).length,
  },
  items: {
    masterRows: items.length,
    used: new Set(sales.map(row => row.fish_variety_id)).size,
    missingReferences: sales.filter(row => !itemIds.has(row.fish_variety_id)).length,
  },
  monthlyCoverage: monthlyCoverage(sales),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

async function readAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await client.from(table).select(columns).order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1_000) return rows;
  }
}

function readEnvironment(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/).flatMap(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const separator = trimmed.indexOf('=');
    return separator < 0 ? [] : [[trimmed.slice(0, separator), trimmed.slice(separator + 1)]];
  }));
}

function normalizeName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function groupBy(rows, keyFor) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    result.set(key, [...(result.get(key) ?? []), row]);
  }
  return result;
}

function monthlyCoverage(rows) {
  const result = {};
  for (const row of rows) {
    const month = row.sale_date.slice(0, 7);
    result[month] ??= { rows: 0, days: new Set(), crates: 0 };
    result[month].rows += 1;
    result[month].days.add(row.sale_date);
    result[month].crates += Number(row.quantity_crates);
  }
  return Object.fromEntries(Object.entries(result).map(([month, value]) => [month, {
    rows: value.rows,
    daysWithSales: value.days.size,
    crates: value.crates,
  }]));
}
