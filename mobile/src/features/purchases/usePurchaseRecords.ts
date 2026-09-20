import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  addSupplier,
  createPurchaseBatch,
  deleteUnbilledPurchaseGroup,
  getFishVarieties,
  getFrequentPurchaseVarietyIds,
  getStockSnapshot,
  getSuppliers,
  getPurchasesByDate,
  updateUnbilledPurchaseGroup,
} from '../../api/stock';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { FishVariety, Purchase, Supplier, SupplierCreateInput } from '../../types';
import { toLocalDateString } from '../../utils/date';

export type PurchaseDraftItem = {
  purchaseId?: number;
  varietyId: number;
  varietyName: string;
  crates: number;
  kg: number;
};

export type PurchaseGroup = {
  key: string;
  supplierId: number;
  supplierName: string;
  supplierType: 'mediator' | 'farmer';
  farmerName: string;
  location?: string;
  purchases: Purchase[];
};

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function isJwtClockError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'PGRST303';
}

export function usePurchaseRecords() {
  const { date, goToPreviousDay, goToNextDay, goToToday } = useBusinessDate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [frequentVarietyIds, setFrequentVarietyIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [farmerName, setFarmerName] = useState('');
  const [location, setLocation] = useState('');
  const [fishVarietyId, setFishVarietyId] = useState<number | null>(null);
  const [quantityCrates, setQuantityCrates] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [draftItems, setDraftItems] = useState<PurchaseDraftItem[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingGroup, setEditingGroup] = useState<PurchaseGroup | null>(null);
  const [editingDraftPurchaseId, setEditingDraftPurchaseId] = useState<number | null>(null);

  const loadData = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);

    try {
      const fetchData = () => Promise.all([
          getPurchasesByDate(date),
          getFishVarieties(),
          getSuppliers(),
          getFrequentPurchaseVarietyIds(),
        ]);

      let result;
      try {
        result = await fetchData();
      } catch (error) {
        if (!isJwtClockError(error)) throw error;
        await wait(2_500);
        result = await fetchData();
      }

      const [purchaseRows, itemRows, supplierRows, frequentIds] = result;
      setPurchases(purchaseRows);
      setVarieties(itemRows);
      setSuppliers(supplierRows);
      setFrequentVarietyIds(frequentIds);
    } catch (error) {
      console.error('Unable to load purchases:', error);
      Alert.alert('Unable to load purchases', 'Check the connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addDraftItem = () => {
    const crates = Number.parseInt(quantityCrates, 10) || 0;
    const kg = Number.parseFloat(quantityKg) || 0;
    const variety = varieties.find((candidate) => candidate.id === fishVarietyId);

    if (!variety) {
      Alert.alert('Select an item', 'Choose an item and grade first.');
      return;
    }
    if (crates < 0 || kg < 0 || (crates === 0 && kg === 0)) {
      Alert.alert('Check quantity', 'Enter crates, kg, or both. Values cannot be negative.');
      return;
    }

    setDraftItems((current) => {
      const existing = current.find((item) => item.varietyId === variety.id);
      if (!existing) {
        return [...current, { purchaseId: editingDraftPurchaseId ?? undefined, varietyId: variety.id, varietyName: variety.name, crates, kg }];
      }
      return current.map((item) => item.varietyId === variety.id
        ? { ...item, crates: item.crates + crates, kg: item.kg + kg }
        : item);
    });
    setFishVarietyId(null);
    setQuantityCrates('');
    setQuantityKg('');
    setEditingDraftPurchaseId(null);
  };

  const editDraftItem = (index: number) => {
    const draft = draftItems[index];
    setFishVarietyId(draft.varietyId);
    setQuantityCrates(String(draft.crates));
    setQuantityKg(String(draft.kg));
    setEditingDraftPurchaseId(draft.purchaseId ?? null);
    setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const removeDraftItem = (index: number) => {
    setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const createSupplier = async (input: SupplierCreateInput): Promise<boolean> => {
    if (!input.name.trim() || !input.location.trim()) return false;
    try {
      const created = await addSupplier(input);
      if (!created) throw new Error('Supplier was not created');
      setSuppliers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(created.id);
      return true;
    } catch (error) {
      console.error('Unable to add supplier:', error);
      Alert.alert('Unable to add supplier', 'Check the details and try again.');
      return false;
    }
  };

  const refreshVarieties = async (preferredItemCode?: string) => {
    const itemRows = await getFishVarieties();
    setVarieties(itemRows);
    if (preferredItemCode) {
      const firstVariant = itemRows.find((variant) => variant.item_code === preferredItemCode);
      if (firstVariant) setFishVarietyId(firstVariant.id);
    }
  };

  const saveBatch = async () => {
    const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
    const needsSourceFarmer = selectedSupplier?.supplier_type === 'mediator';
    if (!selectedSupplier || (needsSourceFarmer && !farmerName.trim()) || draftItems.length === 0) {
      const message = 'Select the primary supplier, enter a source farmer when required, then add at least one item.';
      setSaveError(message);
      Alert.alert('Incomplete purchase', message);
      return;
    }

    setSaveError(null);
    setSubmitting(true);
    try {
      if (editingGroup) {
        const unbilled = editingGroup.purchases.filter(purchase => purchase.billing_status === 'unbilled');
        const stockRows = await getStockSnapshot(toLocalDateString());
        const stockByVariety = new Map(stockRows.map(row => [row.itemVariantId, row]));
        const originalByVariety = new Map<number, { crates: number; kg: number }>();
        unbilled.forEach(purchase => {
          const current = originalByVariety.get(purchase.fish_variety_id) ?? { crates: 0, kg: 0 };
          current.crates += purchase.quantity_crates;
          current.kg += Number(purchase.quantity_kg);
          originalByVariety.set(purchase.fish_variety_id, current);
        });
        const editedByVariety = new Map(draftItems.map(item => [item.varietyId, { crates: item.crates, kg: item.kg, name: item.varietyName }]));
        const reductionIssue = [...originalByVariety.entries()].map(([varietyId, original]) => {
          const edited = editedByVariety.get(varietyId) ?? { crates: 0, kg: 0, name: varieties.find(item => item.id === varietyId)?.name ?? 'This item' };
          const stockRow = stockByVariety.get(varietyId);
          const crateReduction = Math.max(0, original.crates - edited.crates);
          const kgReduction = Math.max(0, original.kg - edited.kg);
          return {
            name: edited.name,
            crateReduction,
            kgReduction,
            availableCrates: Number(stockRow?.closingCrates ?? 0),
            availableKg: Number(stockRow?.closingKg ?? 0),
          };
        }).find(issue => issue.crateReduction > issue.availableCrates || issue.kgReduction > issue.availableKg);

        if (reductionIssue) {
          const available = [
            `${reductionIssue.availableCrates} cr`,
            `${reductionIssue.availableKg} kg`,
          ].join(' and ');
          const message = `${reductionIssue.name} has only ${available} available. Some of the original quantity has already been sold. Correct the related sale first, or keep this purchase quantity unchanged.`;
          setSaveError(message);
          Alert.alert('Cannot reduce purchased stock', message);
          return;
        }
        await updateUnbilledPurchaseGroup({
          purchaseIds: unbilled.map(purchase => purchase.id),
          items: draftItems.map(item => ({
            id: item.purchaseId, fishVarietyId: item.varietyId,
            quantityCrates: item.crates, quantityKg: item.kg,
          })),
        });
        setEditingGroup(null);
      } else {
      await createPurchaseBatch({
        supplierId: selectedSupplier.id,
        farmerName,
        purchaseDate: date,
        location,
        items: draftItems.map((item) => ({
          fishVarietyId: item.varietyId,
          quantityCrates: item.crates,
          quantityKg: item.kg,
        })),
      });
      }
      const savedCount = draftItems.length;
      setDraftItems([]);
      setFarmerName('');
      setFishVarietyId(null);
      setQuantityCrates('');
      setQuantityKg('');
      await loadData();
      Alert.alert('Purchase saved', `${savedCount} item${savedCount === 1 ? '' : 's'} saved together.`);
    } catch (error) {
      console.error('Unable to save purchase batch:', error);
      const detail = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : '';
      const message = detail.toLowerCase().includes('business day')
        ? 'This business day is closed. Reopen or correct the day before changing its purchases.'
        : detail.toLowerCase().includes('insufficient')
          ? 'This purchase cannot be reduced because part of its stock has already been sold.'
          : detail || 'Nothing was saved. Check the details and try again.';
      setSaveError(message);
      Alert.alert('Unable to save purchase', message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingGroup = (group: PurchaseGroup) => {
    const unbilled = group.purchases.filter(purchase => purchase.billing_status === 'unbilled');
    setEditingGroup(group);
    setSupplierId(group.supplierId);
    setFarmerName(group.supplierType === 'farmer' ? '' : group.farmerName);
    setLocation(group.location ?? '');
    setDraftItems(unbilled.map(purchase => ({
      purchaseId: purchase.id,
      varietyId: purchase.fish_variety_id,
      varietyName: purchase.fish_variety_name ?? 'Unknown item',
      crates: purchase.quantity_crates,
      kg: Number(purchase.quantity_kg),
    })));
    setFishVarietyId(null);
    setQuantityCrates('');
    setQuantityKg('');
    setEditingDraftPurchaseId(null);
    setSaveError(null);
  };

  const cancelEditingGroup = () => {
    setEditingGroup(null);
    setDraftItems([]);
    setSupplierId(null);
    setFarmerName('');
    setLocation('');
    setFishVarietyId(null);
    setQuantityCrates('');
    setQuantityKg('');
    setEditingDraftPurchaseId(null);
    setSaveError(null);
  };

  const deleteGroup = (group: PurchaseGroup) => {
    const unbilled = group.purchases.filter(purchase => purchase.billing_status === 'unbilled');
    Alert.alert('Delete purchase?', 'All unbilled items in this purchase will be removed and stock will be reversed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteUnbilledPurchaseGroup(unbilled.map(purchase => purchase.id));
          await loadData();
        } catch (error) {
          Alert.alert('Unable to delete purchase', error instanceof Error ? error.message : 'Please try again.');
        }
      } },
    ]);
  };

  const saveGroupEdit = async (items: Array<{
    id: number;
    fishVarietyId: number;
    quantityCrates: number;
    quantityKg: number;
  }>): Promise<boolean> => {
    if (!editingGroup) return false;
    setSubmitting(true);
    try {
      const unbilled = editingGroup.purchases.filter((purchase) => purchase.billing_status === 'unbilled');
      await updateUnbilledPurchaseGroup({
        purchaseIds: unbilled.map((purchase) => purchase.id),
        items,
      });
      setEditingGroup(null);
      await loadData();
      return true;
    } catch (error) {
      console.error('Unable to update purchase group:', error);
      Alert.alert('Unable to update purchase', 'Check quantities and make sure each item and grade appears only once.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const groups = useMemo<PurchaseGroup[]>(() => {
    const grouped = new Map<string, PurchaseGroup>();
    for (const purchase of purchases) {
      const key = `${purchase.supplier_id}:${purchase.farmer_id}:${purchase.location ?? ''}`;
      const existing = grouped.get(key);
      if (existing) existing.purchases.push(purchase);
      else grouped.set(key, {
        key,
        supplierId: purchase.supplier_id,
        supplierName: purchase.supplier_name ?? 'Unknown supplier',
        supplierType: purchase.supplier_type ?? 'mediator',
        farmerName: purchase.farmer_name ?? 'Unknown farmer',
        location: purchase.location,
        purchases: [purchase],
      });
    }
    return [...grouped.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }, [purchases]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return {
    date, goToPreviousDay, goToNextDay, goToToday,
    varieties, frequentVarietyIds, suppliers, groups, loading, refreshing, submitting, saveError,
    supplierId, setSupplierId, farmerName, setFarmerName, location, setLocation,
    fishVarietyId, setFishVarietyId, quantityCrates, setQuantityCrates,
    quantityKg, setQuantityKg, draftItems, collapsedGroups, editingGroup,
    editingDraftPurchaseId,
    refresh: () => loadData(true), addDraftItem, editDraftItem, removeDraftItem,
    createSupplier, refreshVarieties, saveBatch, toggleGroup,
    startEditingGroup, cancelEditingGroup, deleteGroup,
    saveGroupEdit,
  };
}
