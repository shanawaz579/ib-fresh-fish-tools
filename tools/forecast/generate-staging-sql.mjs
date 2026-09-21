import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const inputPath = argument('--input');
const outputDirectory = argument('--output-dir');
if (!inputPath || !outputDirectory) {
  throw new Error('Usage: node generate-staging-sql.mjs --input private-import.json --output-dir private-directory');
}

const payload = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
if (payload.formatVersion !== 1 || !payload.batch || !Array.isArray(payload.sales)) {
  throw new Error('Unsupported or incomplete forecast import payload.');
}

const output = path.resolve(outputDirectory);
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const files = [];

write('000_batch.sql', batchSql(payload.batch));
write('010_customers.sql', mappingSql('customer', payload.batch.sourceSystem, payload.customers));
write('020_items.sql', mappingSql('item', payload.batch.sourceSystem, payload.items));

for (let index = 0; index < payload.sales.length; index += 500) {
  const sequence = String(index / 500).padStart(3, '0');
  write(`100_sales_${sequence}.sql`, salesSql(payload.batch, payload.sales.slice(index, index + 500)));
}

write('900_finalize.sql', finalizeSql(payload.batch));
process.stdout.write(`${JSON.stringify({ files: files.length, rows: payload.sales.length, output }, null, 2)}\n`);

function write(name, sql) {
  const target = path.join(output, name);
  fs.writeFileSync(target, sql, { mode: 0o600 });
  files.push(target);
}

function batchSql(batch) {
  return `BEGIN;
INSERT INTO working.forecast_import_batches (
  source_system, source_project_ref, source_start_date, source_end_date,
  cutover_date, source_row_count, status, notes
) VALUES (
  ${literal(batch.sourceSystem)}, ${literal(batch.sourceProjectRef)},
  ${literal(batch.sourceStartDate)}::date, ${literal(batch.sourceEndDate)}::date,
  ${literal(batch.cutoverDate)}::date, ${integer(batch.sourceRowCount)}, 'staged',
  'Legacy history staged for mapping review; loose kilograms excluded from training.'
)
ON CONFLICT (source_system, source_start_date, source_end_date, cutover_date)
DO UPDATE SET source_row_count = EXCLUDED.source_row_count;
COMMIT;
`;
}

function mappingSql(kind, sourceSystem, rows) {
  const customer = kind === 'customer';
  const table = customer ? 'forecast_customer_mappings' : 'forecast_item_mappings';
  const legacyId = customer ? 'legacy_customer_id' : 'legacy_item_id';
  const targetId = customer ? 'customer_id' : 'item_variant_id';
  const targetTable = customer ? 'customers' : 'item_variants';
  const idKey = customer ? 'legacyCustomerId' : 'legacyItemId';
  const jsonRows = rows.map(row => ({
    legacy_id: row[idKey],
    legacy_name: row.legacyName,
    normalized_name: row.normalizedName,
  }));
  const json = dollarJson(jsonRows);
  return `BEGIN;
INSERT INTO working.${table} (
  source_system, ${legacyId}, legacy_name, normalized_name
)
SELECT ${literal(sourceSystem)}, row_value.legacy_id, row_value.legacy_name, row_value.normalized_name
FROM jsonb_to_recordset(${json}::jsonb)
  AS row_value(legacy_id bigint, legacy_name text, normalized_name text)
ON CONFLICT (source_system, ${legacyId}) DO UPDATE
SET legacy_name = EXCLUDED.legacy_name,
    normalized_name = EXCLUDED.normalized_name;

UPDATE working.${table} mapping
SET ${targetId} = current_row.id,
    match_method = 'exact',
    confidence = 1
FROM working.${targetTable} current_row
WHERE mapping.source_system = ${literal(sourceSystem)}
  AND mapping.match_status = 'proposed'
  AND mapping.normalized_name = btrim(regexp_replace(lower(current_row.name), '[^a-z0-9]+', ' ', 'g'));
COMMIT;
`;
}

function salesSql(batch, rows) {
  const json = dollarJson(rows.map(row => ({
    legacy_sale_id: row.legacySaleId,
    sale_date: row.saleDate,
    legacy_customer_id: row.legacyCustomerId,
    legacy_customer_name: row.legacyCustomerName,
    legacy_item_id: row.legacyItemId,
    legacy_item_name: row.legacyItemName,
    quantity_crates: row.quantityCrates,
    quantity_kg: row.quantityKg,
    source_fingerprint: row.sourceFingerprint,
  })));
  return `BEGIN;
INSERT INTO working.forecast_sales_history (
  import_batch_id, source_system, legacy_sale_id, sale_date,
  legacy_customer_id, legacy_customer_name, legacy_item_id, legacy_item_name,
  quantity_crates, quantity_kg, source_fingerprint
)
SELECT batch.id, ${literal(batch.sourceSystem)}, row_value.*
FROM jsonb_to_recordset(${json}::jsonb) AS row_value(
  legacy_sale_id bigint, sale_date date,
  legacy_customer_id bigint, legacy_customer_name text,
  legacy_item_id bigint, legacy_item_name text,
  quantity_crates integer, quantity_kg numeric, source_fingerprint text
)
JOIN working.forecast_import_batches batch
  ON batch.source_system = ${literal(batch.sourceSystem)}
 AND batch.source_start_date = ${literal(batch.sourceStartDate)}::date
 AND batch.source_end_date = ${literal(batch.sourceEndDate)}::date
 AND batch.cutover_date = ${literal(batch.cutoverDate)}::date
ON CONFLICT (source_system, legacy_sale_id) DO NOTHING;
COMMIT;
`;
}

function finalizeSql(batch) {
  return `BEGIN;
UPDATE working.forecast_import_batches batch
SET imported_row_count = history.row_count,
    status = 'staged'
FROM (
  SELECT import_batch_id, count(*)::integer AS row_count
  FROM working.forecast_sales_history
  WHERE source_system = ${literal(batch.sourceSystem)}
  GROUP BY import_batch_id
) history
WHERE batch.id = history.import_batch_id;

DO $$
DECLARE
  imported integer;
BEGIN
  SELECT imported_row_count INTO imported
  FROM working.forecast_import_batches
  WHERE source_system = ${literal(batch.sourceSystem)}
    AND source_start_date = ${literal(batch.sourceStartDate)}::date
    AND source_end_date = ${literal(batch.sourceEndDate)}::date
    AND cutover_date = ${literal(batch.cutoverDate)}::date;
  IF imported IS DISTINCT FROM ${integer(batch.sourceRowCount)} THEN
    RAISE EXCEPTION 'Forecast import count mismatch: expected %, found %', ${integer(batch.sourceRowCount)}, imported;
  END IF;
END;
$$;
COMMIT;

SELECT
  batch.status,
  batch.source_row_count,
  batch.imported_row_count,
  (SELECT count(*) FROM working.forecast_customer_mappings WHERE source_system = batch.source_system) AS customer_mappings,
  (SELECT count(*) FROM working.forecast_customer_mappings WHERE source_system = batch.source_system AND match_method = 'exact') AS exact_customer_proposals,
  (SELECT count(*) FROM working.forecast_item_mappings WHERE source_system = batch.source_system) AS item_mappings,
  (SELECT count(*) FROM working.forecast_item_mappings WHERE source_system = batch.source_system AND match_method = 'exact') AS exact_item_proposals
FROM working.forecast_import_batches batch
WHERE batch.source_system = ${literal(batch.sourceSystem)};
`;
}

function dollarJson(value) {
  const text = JSON.stringify(value);
  const delimiter = '$forecast_json$';
  if (text.includes(delimiter)) throw new Error('Unexpected JSON delimiter collision.');
  return `${delimiter}${text}${delimiter}`;
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function integer(value) {
  if (!Number.isSafeInteger(Number(value))) throw new Error(`Expected an integer, received ${value}`);
  return String(Number(value));
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
