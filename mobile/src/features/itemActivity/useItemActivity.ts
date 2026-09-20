import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getCustomers, getFishVarieties, getPurchasesByDateRange, getSalesByDateRange, getStockSnapshot, getSuppliers } from '../../api/stock';
import type { StockSnapshot } from '../../domain/stockLedger';
import type { Customer, FishVariety, Purchase, Sale, Supplier } from '../../types';
import { addDays, toLocalDateString } from '../../utils/date';

export type ActivityMode = 'sales' | 'purchases';
export type ActivityRangeDays = 1 | 7 | 30;
export type ActivityRow = { id:number; date:string; partyId:number; partyName:string; varietyId:number; varietyName:string; crates:number; kg:number; status:string };

export function useItemActivity() {
  const today = toLocalDateString();
  const [mode, setMode] = useState<ActivityMode>('sales');
  const [rangeDays, setRangeDays] = useState<ActivityRangeDays>(7);
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
  const fromDate = addDays(today, -(rangeDays - 1));

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [saleRows, purchaseRows, itemRows, customerRows, supplierRows, stockRows] = await Promise.all([
        getSalesByDateRange(fromDate, today), getPurchasesByDateRange(fromDate, today), getFishVarieties(), getCustomers(), getSuppliers(), getStockSnapshot(today),
      ]);
      setSales(saleRows); setPurchases(purchaseRows); setVarieties(itemRows); setCustomers(customerRows); setSuppliers(supplierRows); setStock(stockRows);
    } catch (error) {
      console.error('Unable to load trade activity:', error);
      Alert.alert('Unable to load activity', 'Check the connection and try again.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [fromDate, today]);

  useEffect(() => { void load(); }, [load]);

  const allRows = useMemo<ActivityRow[]>(() => mode === 'sales'
    ? sales.map(sale => ({ id:sale.id, date:sale.sale_date, partyId:sale.customer_id, partyName:sale.customer_name ?? 'Unknown customer', varietyId:sale.fish_variety_id, varietyName:sale.fish_variety_name ?? 'Unknown item', crates:sale.quantity_crates, kg:Number(sale.quantity_kg), status:sale.billing_status ?? 'unbilled' }))
    : purchases.map(purchase => ({ id:purchase.id, date:purchase.purchase_date, partyId:purchase.supplier_id, partyName:purchase.supplier_name ?? 'Unknown supplier', varietyId:purchase.fish_variety_id, varietyName:purchase.fish_variety_name ?? 'Unknown item', crates:purchase.quantity_crates, kg:Number(purchase.quantity_kg), status:purchase.billing_status ?? 'unbilled' })), [mode, purchases, sales]);
  const activeVarietyIds = useMemo(() => new Set(allRows.map(row => row.varietyId)), [allRows]);
  const activePartyIds = useMemo(() => new Set(allRows.map(row => row.partyId)), [allRows]);
  const activeVarieties = useMemo(() => varieties.filter(item => activeVarietyIds.has(item.id)), [activeVarietyIds, varieties]);
  const sourceParties = mode === 'sales' ? customers : suppliers;
  const parties = useMemo(() => sourceParties.filter(party => activePartyIds.has(party.id)), [activePartyIds, sourceParties]);
  const rows = useMemo(() => allRows.filter(row => (!selectedVarietyId || row.varietyId === selectedVarietyId) && (!selectedPartyId || row.partyId === selectedPartyId)).sort((a,b) => b.date.localeCompare(a.date) || a.varietyName.localeCompare(b.varietyName)), [allRows, selectedPartyId, selectedVarietyId]);
  const partySummaries = useMemo(() => summarize(rows, 'party'), [rows]);
  const itemSummaries = useMemo(() => summarize(rows, 'item'), [rows]);
  const totals = useMemo(() => ({ crates:rows.reduce((sum,row)=>sum+row.crates,0), kg:rows.reduce((sum,row)=>sum+row.kg,0), transactions:rows.length, unbilled:rows.filter(row=>row.status==='unbilled').length }), [rows]);
  const selectMode = (next: ActivityMode) => { setMode(next); setSelectedPartyId(null); setSelectedVarietyId(null); };
  const selectRange = (next: ActivityRangeDays) => { setRangeDays(next); setSelectedPartyId(null); setSelectedVarietyId(null); };
  const selectedStock = selectedVarietyId ? stock.find(row => row.itemVariantId === selectedVarietyId) : undefined;
  const stockSummary = { availableCrates:selectedStock?.closingCrates ?? 0, totalCrates:(selectedStock?.openingCrates ?? 0)+(selectedStock?.inwardCrates ?? 0), availableKg:selectedStock?.closingKg ?? 0, totalKg:(selectedStock?.openingKg ?? 0)+(selectedStock?.inwardKg ?? 0) };

  return { today, fromDate, mode, selectMode, rangeDays, selectRange, selectedVarietyId, setSelectedVarietyId, selectedPartyId, setSelectedPartyId, varieties:activeVarieties, parties, rows, partySummaries, itemSummaries, totals, stockSummary, loading, refreshing, refresh:()=>load(true) };
}

function summarize(rows: ActivityRow[], by: 'party' | 'item') {
  const grouped = new Map<number,{id:number;name:string;crates:number;kg:number;lines:number}>();
  rows.forEach(row => { const id=by==='party'?row.partyId:row.varietyId; const name=by==='party'?row.partyName:row.varietyName; const current=grouped.get(id)??{id,name,crates:0,kg:0,lines:0}; current.crates+=row.crates; current.kg+=row.kg; current.lines+=1; grouped.set(id,current); });
  return [...grouped.values()].sort((a,b)=>b.crates-a.crates||b.kg-a.kg||a.name.localeCompare(b.name));
}
