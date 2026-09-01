import supabase from '../lib/supabase';
import type {
  CatalogItem,
  CatalogItemInput,
  ItemGrade,
  ItemVariant,
  UnitOfMeasure,
} from '../types';

type CatalogItemRow = Omit<CatalogItem, 'variants'> & {
  variants?: Array<ItemVariant & { grade?: ItemGrade | null }>;
};

export function isDuplicateCatalogItemError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const databaseError = error as { code?: string; message?: string };
  return databaseError.code === '23505'
    || databaseError.message?.toLocaleLowerCase().includes('already exists') === true;
}

export function generateItemCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export async function getUnits(): Promise<UnitOfMeasure[]> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('is_active', true)
    .order('code');

  if (error) throw error;
  return data ?? [];
}

export async function getItemGrades(): Promise<ItemGrade[]> {
  const { data, error } = await supabase
    .from('item_grades')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      primary_unit:units!items_primary_unit_id_fkey(*),
      secondary_unit:units!items_secondary_unit_id_fkey(*),
      inventory_unit:units!items_inventory_unit_id_fkey(*),
      variants:item_variants(
        *,
        grade:item_grades(*)
      )
    `)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  return ((data ?? []) as unknown as CatalogItemRow[]).map((item) => ({
    ...item,
    variants: (item.variants ?? [])
      .filter((variant) => variant.is_active)
      .map((variant) => ({
        ...variant,
        grade_code: variant.grade?.code,
        grade_name: variant.grade?.name,
        grade_sort_order: variant.grade?.sort_order,
      }))
      .sort((a, b) => (a.grade_sort_order ?? 999) - (b.grade_sort_order ?? 999)),
  }));
}

export async function saveCatalogItem(input: CatalogItemInput): Promise<number> {
  const stableCode = input.id ? input.code.trim() : generateItemCode(input.name);

  const { data, error } = await supabase.rpc('upsert_catalog_item', {
    p_item_id: input.id ?? null,
    p_name: input.name.trim(),
    p_code: stableCode,
    p_grade_codes: input.gradeCodes,
    p_primary_unit_code: input.primaryUnitCode,
    p_secondary_unit_code: input.secondaryUnitCode,
    p_inventory_unit_code: input.inventoryUnitCode,
    p_default_kg_per_crate: input.defaultKgPerCrate,
  });

  if (error) throw error;
  return data as number;
}

export async function archiveCatalogItem(itemId: number): Promise<void> {
  const { error } = await supabase.rpc('archive_catalog_item', {
    p_item_id: itemId,
  });

  if (error) throw error;
}
