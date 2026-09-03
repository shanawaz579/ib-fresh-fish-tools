import type { FishVariety } from '../types';

export const DEFAULT_CRATE_WEIGHT_KG = 35;

export const FISH_VARIETY_ORDER = [
  'Pangasius',
  'Roopchand',
  'Rohu',
  'Katla',
  'Tilapia',
  'Silver Carp',
  'Grass Carp',
  'Common Carp',
] as const;

export const FISH_SIZE_ORDER = ['Big', 'Medium', 'Small'] as const;

// Operational selectors show the heaviest grade first within each item group.
const GRADE_ORDER = ['OB', 'B', 'M', 'S'] as const;

export function getTotalWeightKg(
  crates: number,
  looseWeightKg: number,
  crateWeightKg = DEFAULT_CRATE_WEIGHT_KG,
): number {
  return Math.max(crates, 0) * Math.max(crateWeightKg, 0) + Math.max(looseWeightKg, 0);
}

export function getPurchaseTotalWeightKg(
  crates: number,
  looseKg: number,
  crateWeightKg = DEFAULT_CRATE_WEIGHT_KG,
): number {
  return Math.max(crates, 0) * Math.max(crateWeightKg, 0) + Math.max(looseKg, 0);
}

export function extractFishSize(varietyName: string): { name: string; size: string } {
  const structuredGrade = varietyName.match(/^(.*?)\s+-\s+(OB|B|M|S)$/i);
  if (structuredGrade) {
    return {
      name: structuredGrade[1].trim(),
      size: structuredGrade[2].toUpperCase(),
    };
  }

  const legacyOverBig = varietyName.match(/^(.*?)\s+Over\s+Big$/i);
  if (legacyOverBig) {
    return { name: legacyOverBig[1].trim(), size: 'OB' };
  }

  for (const sizeName of FISH_SIZE_ORDER) {
    if (varietyName.includes(sizeName)) {
      return {
        name: varietyName.replace(sizeName, '').trim(),
        size: sizeName.charAt(0),
      };
    }
  }

  return { name: varietyName, size: '' };
}

export function getFishVarietySortKey(varietyName: string): number {
  const structured = extractFishSize(varietyName);
  if (structured.size && GRADE_ORDER.includes(structured.size as typeof GRADE_ORDER[number])) {
    const knownItemIndex = FISH_VARIETY_ORDER.indexOf(
      structured.name as typeof FISH_VARIETY_ORDER[number],
    );
    const itemIndex = knownItemIndex === -1 ? FISH_VARIETY_ORDER.length : knownItemIndex;
    return itemIndex * 10 + GRADE_ORDER.indexOf(structured.size as typeof GRADE_ORDER[number]);
  }

  let baseName = varietyName;
  let sizeName = '';

  for (const candidate of FISH_SIZE_ORDER) {
    if (varietyName.includes(candidate)) {
      baseName = varietyName.replace(candidate, '').trim();
      sizeName = candidate;
      break;
    }
  }

  const varietyIndex = FISH_VARIETY_ORDER.indexOf(baseName as typeof FISH_VARIETY_ORDER[number]);
  if (varietyIndex === -1) return Number.MAX_SAFE_INTEGER;

  const sizeIndex = FISH_SIZE_ORDER.indexOf(sizeName as typeof FISH_SIZE_ORDER[number]);
  return varietyIndex * 10 + Math.max(sizeIndex, 0);
}

export function sortFishVarieties(varieties: FishVariety[]): FishVariety[] {
  return [...varieties].sort((a, b) => {
    const catalogOrder = (a.item_name ?? a.name).localeCompare(b.item_name ?? b.name)
      || (b.grade_sort_order ?? -1) - (a.grade_sort_order ?? -1);
    if (a.item_name || b.item_name) return catalogOrder || a.id - b.id;

    const orderDifference = getFishVarietySortKey(a.name) - getFishVarietySortKey(b.name);
    return orderDifference || a.name.localeCompare(b.name) || a.id - b.id;
  });
}
