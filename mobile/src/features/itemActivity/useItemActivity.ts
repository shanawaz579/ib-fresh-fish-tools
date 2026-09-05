import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getCustomers, getFishVarieties, getPurchasesByDate, getSalesByDate, getStockSnapshot, getSuppliers } from '../../api/stock';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { StockSnapshot } from '../../domain/stockLedger';
import type { Customer, FishVariety, Purchase, Sale, Supplier } from '../../types';

export type ActivityMode = 'sales' | 'purchases';
export type ActivityRow = { id: number; partyId: number; partyName: string; varietyId: number; varietyName: string; crates: number; kg: number; status: string };

export function useItemActivity() {
  const { date, goToPreviousDay, goToNextDay, goToToday } = useBusinessDate();
  const [mode, setMode] = useState<ActivityMode>('sales');
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | null>(null);
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stock, setStock] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [saleRows, purchaseRows, itemRows, customerRows, supplierRows, stockRows] = await Promise.all([
        getSalesByDate(date), getPurchasesByDate(date), getFishVarieties(), getCustomers(), getSuppliers(), getStockSnapshot(date),
      ]);
      setSales(saleRows); setPurchases(purchaseRows); setVarieties(itemRows); setCustomers(customerRows); setSuppliers(supplierRows); setStock(stockRows);
    } catch (error) {
      console.error('Unable to load item activity:', error);
      Alert.alert('Unable to load activity', 'Check the connection and try again.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo<ActivityRow[]>(() => mode === 'sales'
    ? sales.map(sale => ({ id: sale.id, partyId: sale.customer_id, partyName: sale.customer_name ?? 'Unknown customer', varietyId: sale.fish_variety_id, varietyName: sale.fish_variety_name ?? 'Unknown item', crates: sale.quantity_crates, kg: Number(sale.quantity_kg), status: sale.billing_status ?? 'unbilled' }))
    : purchases.map(purchase => ({ id: purchase.id, partyId: purchase.supplier_id, partyName: purchase.supplier_name ?? 'Unknown supplier', varietyId: purchase.fish_variety_id, varietyName: purchase.fish_variety_name ?? 'Unknown item', crates: purchase.quantity_crates, kg: Number(purchase.quantity_kg), status: purchase.billing_status ?? 'unbilled' })), [mode, purchases, sales]);
  const activeVarieties = useMemo(() => varieties.filter(item => rows.some(row => row.varietyId === item.id)), [rows, varieties]);
  const parties = mode === 'sales' ? customers : suppliers;
  const quickVarietyIds = useMemo(() => {
    const totals = new Map<number, number>();
    rows.forEach(row => totals.set(row.varietyId, (totals.get(row.varietyId) ?? 0) + row.crates * 1000 + row.kg));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
  }, [rows]);
  const filteredRows = useMemo(() => rows.filter(row => (!selectedVarietyId || row.varietyId === selectedVarietyId) && (!selectedPartyId || row.partyId === selectedPartyId)), [rows, selectedPartyId, selectedVarietyId]);
  const partySummaries = useMemo(() => {
    const grouped = new Map<number, { id: number; name: string; crates: number; kg: number; lines: number }>();
    filteredRows.forEach(row => { const current = grouped.get(row.partyId) ?? { id: row.partyId, name: row.partyName, crates: 0, kg: 0, lines: 0 }; current.crates += row.crates; current.kg += row.kg; current.lines += 1; grouped.set(row.partyId, current); });
    return [...grouped.values()].sort((a, b) => b.crates - a.crates || b.kg - a.kg || a.name.localeCompare(b.name));
  }, [filteredRows]);
  const selectMode = (next: ActivityMode) => { setMode(next); setSelectedPartyId(null); setSelectedVarietyId(null); };
  const selectedStock = selectedVarietyId ? stock.find(row => row.itemVariantId === selectedVarietyId) : undefined;
  const stockSummary = {
    availableCrates: selectedStock?.closingCrates ?? 0,
    totalCrates: (selectedStock?.openingCrates ?? 0) + (selectedStock?.inwardCrates ?? 0),
    availableKg: selectedStock?.closingKg ?? 0,
    totalKg: (selectedStock?.openingKg ?? 0) + (selectedStock?.inwardKg ?? 0),
  };

  return { date, goToPreviousDay, goToNextDay, goToToday, mode, selectMode, selectedVarietyId, setSelectedVarietyId, selectedPartyId, setSelectedPartyId, varieties: activeVarieties, parties, quickVarietyIds, rows: filteredRows, partySummaries, stockSummary, loading, refreshing, refresh: () => load(true) };
}
