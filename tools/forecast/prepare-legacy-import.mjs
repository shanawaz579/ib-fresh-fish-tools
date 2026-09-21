import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const environmentPath = process.env.LEGACY_ENV_FILE || path.join(projectRoot, '.env.local');
const outputArgumentIndex = process.argv.indexOf('--output');
const outputPath = outputArgumentIndex >= 0 ? process.argv[outputArgumentIndex + 1] : null;

if (!outputPath) {
  throw new Error('Pass --output /absolute/private/path/legacy-forecast-import.json');
}

const environment = readEnvironment(environmentPath);
const url = process.env.LEGACY_SUPABASE_URL || environment.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.LEGACY_SUPABASE_KEY || environment.SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error('Set legacy Supabase credentials or provide LEGACY_ENV_FILE.');
}

const client = createClient(url, key, { auth: { persistSession: false } });
const [sales, customers, items] = await Promise.all([
  readAll('sales', 'id,customer_id,fish_variety_id,quantity_crates,quantity_kg,sale_date'),
  readAll('customers', 'id,name'),
  readAll('fish_varieties', 'id,name'),
]);

const customerById = new Map(customers.map(row => [row.id, row]));
const itemById = new Map(items.map(row => [row.id, row]));
const dates = sales.map(row => row.sale_date).sort();
const sourceProjectRef = new URL(url).hostname.split('.')[0];
const sourceSystem = `legacy-supabase:${sourceProjectRef}`;

const payload = {
  formatVersion: 1,
  generatedAt: new Date().toISOString(),
  batch: {
    sourceSystem,
    sourceProjectRef,
    sourceStartDate: dates[0],
    sourceEndDate: dates.at(-1),
    cutoverDate: '2026-09-11',
    sourceRowCount: sales.length,
  },
  customers: customers.map(row => ({
    legacyCustomerId: row.id,
    legacyName: row.name.trim(),
    normalizedName: normalizeName(row.name),
  })),
  items: items.map(row => ({
    legacyItemId: row.id,
    legacyName: row.name.trim(),
    normalizedName: normalizeName(row.name),
  })),
  sales: sales.map(row => {
    const customer = customerById.get(row.customer_id);
    const item = itemById.get(row.fish_variety_id);
    if (!customer || !item) {
      throw new Error(`Legacy sale ${row.id} has a missing master-data reference.`);
    }
    const canonical = [sourceSystem, row.id, row.sale_date, row.customer_id, row.fish_variety_id,
      Number(row.quantity_crates), Number(row.quantity_kg)].join('|');
    return {
      sourceSystem,
      legacySaleId: row.id,
      saleDate: row.sale_date,
      legacyCustomerId: row.customer_id,
      legacyCustomerName: customer.name.trim(),
      legacyItemId: row.fish_variety_id,
      legacyItemName: item.name.trim(),
      quantityCrates: Number(row.quantity_crates),
      quantityKg: Number(row.quantity_kg),
      sourceFingerprint: crypto.createHash('sha256').update(canonical).digest('hex'),
    };
  }),
};

fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`Prepared ${payload.sales.length} rows at ${path.resolve(outputPath)}\n`);
process.stdout.write('No destination database was changed. Keep this file private; it contains customer names.\n');

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
