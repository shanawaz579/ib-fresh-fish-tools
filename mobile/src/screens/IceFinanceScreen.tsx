import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import SearchableSelectModal from '../components/SearchableSelectModal';
import IceCustomerCreateModal from '../features/icePlant/IceCustomerCreateModal';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import { addDays, parseLocalDate, toLocalDateString } from '../utils/date';
import { useBusinessDate } from '../hooks/useBusinessDate';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { createIceCustomer, getIceCustomers, getIceFinanceSummary, getIceMoneyActivity, getIceOutstandingSales, recordIceExpense, recordIcePayment, recordIceSale, voidIceMoneyEntry, type IceCustomer, type IceExpenseCategory, type IceFinanceSummary, type IceMoneyEntry, type IcePaymentMethod } from '../api/iceFinance';
import styles from '../styles/IceFinanceScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'IceFinance'>;
type ViewMode = 'activity' | 'dashboard';
type EntryMode = 'sale' | 'expense' | null;
type Filter = 'all' | 'sale' | 'expense';
type Period = 'today' | '7days' | 'month';
type SalePaymentType = 'paid' | 'partial' | 'credit';
const METHODS: IcePaymentMethod[] = ['cash', 'upi', 'bank'];
const CATEGORIES: IceExpenseCategory[] = ['electricity', 'labour', 'maintenance', 'transport', 'water', 'other'];
const EMPTY_SUMMARY: IceFinanceSummary = { sales: 0, expenses: 0, net: 0, blocks: 0, received: 0, outstanding: 0, cash: 0, upi: 0, bank: 0 };
const messageOf = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again.';

export default function IceFinanceScreen({ navigation, route }: Props) {
  const businessDate = useBusinessDate();
  const { formatMoney } = useBusinessConfig();
  const [view, setView] = useState<ViewMode>(route.params?.initialView ?? 'activity');
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [period, setPeriod] = useState<Period>('today');
  const [entries, setEntries] = useState<IceMoneyEntry[]>([]);
  const [outstandingSales, setOutstandingSales] = useState<IceMoneyEntry[]>([]);
  const [summary, setSummary] = useState<IceFinanceSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<IceCustomer[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [showCustomers, setShowCustomers] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [blocks, setBlocks] = useState('');
  const [rate, setRate] = useState('');
  const [paymentType, setPaymentType] = useState<SalePaymentType>('paid');
  const [received, setReceived] = useState('');
  const [method, setMethod] = useState<IcePaymentMethod>('cash');
  const [category, setCategory] = useState<IceExpenseCategory>('electricity');
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [collecting, setCollecting] = useState<IceMoneyEntry | null>(null);

  const total = (Number(blocks) || 0) * (Number(rate) || 0);
  const dateRange = useMemo(() => {
    const today = toLocalDateString();
    if (period === '7days') return { from: addDays(today, -6), to: today };
    if (period === 'month') { const value = parseLocalDate(today); value.setDate(1); return { from: toLocalDateString(value), to: today }; }
    return { from: today, to: today };
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activity, dashboard, outstanding, customerRows] = await Promise.all([getIceMoneyActivity(businessDate.date), getIceFinanceSummary(dateRange.from, dateRange.to), getIceOutstandingSales(), getIceCustomers()]);
      setEntries(activity); setSummary(dashboard); setOutstandingSales(outstanding); setCustomers(customerRows);
    } catch (error) { Alert.alert('Unable to load Ice Plant money', messageOf(error)); }
    finally { setLoading(false); }
  }, [businessDate.date, dateRange.from, dateRange.to]);
  useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setEntryMode(null); setCustomerId(null); setBlocks(''); setRate(''); setPaymentType('paid'); setReceived('');
    setAmount(''); setPayee(''); setNotes(''); setReference(''); setMethod('cash');
  };
  const saveSale = async () => {
    const quantity = Number(blocks); const unitRate = Number(rate); const receivedAmount = paymentType === 'paid' ? total : paymentType === 'credit' ? 0 : Number(received || 0);
    if (!Number.isInteger(quantity) || quantity <= 0 || unitRate <= 0) { Alert.alert('Check sale', 'Enter valid blocks and rate per block.'); return; }
    if (paymentType !== 'paid' && customerId === null) { Alert.alert('Customer required', 'Select a customer for a credit or partial sale.'); return; }
    setSaving(true);
    try { await recordIceSale({ date: businessDate.date, customerId, blocks: quantity, rate: unitRate, received: receivedAmount, method, notes, reference }); resetForm(); await load(); }
    catch (error) { Alert.alert('Sale not saved', messageOf(error)); }
    finally { setSaving(false); }
  };
  const saveExpense = async () => {
    if (Number(amount) <= 0) { Alert.alert('Check expense', 'Enter an amount greater than zero.'); return; }
    setSaving(true);
    try { await recordIceExpense({ date: businessDate.date, category, amount: Number(amount), method, payee, notes, reference }); resetForm(); await load(); }
    catch (error) { Alert.alert('Expense not saved', messageOf(error)); }
    finally { setSaving(false); }
  };
  const collectPayment = async () => {
    if (!collecting || Number(amount) <= 0 || Number(amount) > collecting.balance) { Alert.alert('Check payment', 'Enter an amount within the balance due.'); return; }
    setSaving(true);
    try { await recordIcePayment({ saleId: collecting.id, date: businessDate.date, amount: Number(amount), method, reference }); setCollecting(null); setAmount(''); setReference(''); await load(); }
    catch (error) { Alert.alert('Payment not saved', messageOf(error)); }
    finally { setSaving(false); }
  };
  const voidEntry = (entry: IceMoneyEntry) => {
    const action = async () => { try { await voidIceMoneyEntry(entry.entry_type, entry.id); await load(); } catch (error) { Alert.alert('Entry not voided', messageOf(error)); } };
    const prompt = `Void this ${entry.entry_type}? It will remain in the audit trail.`;
    if (Platform.OS === 'web') { if (window.confirm(prompt)) void action(); return; }
    Alert.alert('Void entry?', prompt, [{ text: 'Cancel', style: 'cancel' }, { text: 'Void', style: 'destructive', onPress: () => { void action(); } }]);
  };
  const visibleEntries = entries.filter(entry => filter === 'all' || entry.entry_type === filter);
  const selectedCustomer = customers.find(row => row.id === customerId);
  const customerOptions = useMemo(() => [{ id: 0, label: 'Walk-in customer', detail: 'No name required for a fully paid sale' }, ...customers.map(row => ({ id: row.id, label: row.name, detail: 'Ice Plant customer' }))], [customers]);

  const createCustomer = async (name: string) => {
    setSaving(true);
    try { const created = await createIceCustomer(name); setCustomers(current => [...current, created].sort((a,b) => a.name.localeCompare(b.name))); setCustomerId(created.id); return true; }
    catch (error) { Alert.alert('Customer not created', messageOf(error)); return false; }
    finally { setSaving(false); }
  };

  const MethodPicker = () => <View style={styles.chipRow}>{METHODS.map(value => <TouchableOpacity key={value} onPress={() => setMethod(value)} style={[styles.chip, method === value && styles.chipOn]}><Text style={[styles.chipText, method === value && styles.chipTextOn]}>{value === 'bank' ? 'Bank' : value.toUpperCase()}</Text></TouchableOpacity>)}</View>;

  return <View style={styles.container}>
    <View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backText}>‹</Text></TouchableOpacity><View><Text style={styles.eyebrow}>ICE PLANT</Text><Text style={styles.title}>Money & dashboard</Text></View></View>
    <View style={styles.tabs}><TouchableOpacity style={[styles.tab, view === 'activity' && styles.tabOn]} onPress={() => setView('activity')}><Text style={[styles.tabText, view === 'activity' && styles.tabTextOn]}>Money</Text></TouchableOpacity><TouchableOpacity style={[styles.tab, view === 'dashboard' && styles.tabOn]} onPress={() => setView('dashboard')}><Text style={[styles.tabText, view === 'dashboard' && styles.tabTextOn]}>Dashboard</Text></TouchableOpacity></View>
    {view === 'activity' ? <>
      <DateNavigator date={businessDate.date} onPrevious={businessDate.goToPreviousDay} onNext={businessDate.goToNextDay} onToday={businessDate.goToToday} canGoNext={businessDate.date < toLocalDateString()} accentColor="#0E7490" />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentBody} keyboardShouldPersistTaps="handled">
        <View style={styles.daySummary}><View><Text style={styles.summaryLabel}>SALES</Text><Text style={styles.salesValue}>{formatMoney(entries.filter(e => e.entry_type === 'sale').reduce((sum,e) => sum+e.amount,0),0)}</Text></View><View><Text style={styles.summaryLabel}>EXPENSES</Text><Text style={styles.expenseValue}>{formatMoney(entries.filter(e => e.entry_type === 'expense').reduce((sum,e) => sum+e.amount,0),0)}</Text></View><View><Text style={styles.summaryLabel}>NET</Text><Text style={styles.netValue}>{formatMoney(entries.reduce((sum,e) => sum+(e.entry_type === 'sale' ? e.amount : -e.amount),0),0)}</Text></View></View>
        <View style={styles.actionRow}><TouchableOpacity style={styles.saleButton} onPress={() => { resetForm(); setEntryMode('sale'); }}><Text style={styles.actionText}>+ Record sale</Text></TouchableOpacity><TouchableOpacity style={styles.expenseButton} onPress={() => { resetForm(); setEntryMode('expense'); }}><Text style={styles.actionText}>+ Record expense</Text></TouchableOpacity></View>
        {entryMode ? <View style={styles.formCard}><View style={styles.formHeader}><Text style={styles.formTitle}>{entryMode === 'sale' ? 'New ice sale' : 'New expense'}</Text><TouchableOpacity onPress={resetForm}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity></View>
          {entryMode === 'sale' ? <><Text style={styles.label}>CUSTOMER *</Text><TouchableOpacity accessibilityLabel="Select Ice Plant customer" style={styles.customerSelect} onPress={() => setShowCustomers(true)}><View><Text style={styles.customerHint}>{selectedCustomer ? 'SELECTED CUSTOMER' : 'SALE TYPE'}</Text><Text style={styles.customerValue}>{selectedCustomer?.name ?? 'Walk-in customer'}</Text></View><Text style={styles.customerChevron}>›</Text></TouchableOpacity><View style={styles.twoColumns}><View style={styles.field}><Text style={styles.label}>BLOCKS *</Text><TextInput style={styles.input} value={blocks} onChangeText={setBlocks} keyboardType="number-pad" placeholder="0" /></View><View style={styles.field}><Text style={styles.label}>RATE / BLOCK *</Text><TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="₹0" /></View></View><View style={styles.totalRow}><Text style={styles.totalLabel}>SALE TOTAL</Text><Text style={styles.totalValue}>{formatMoney(total,0)}</Text></View><Text style={styles.label}>PAYMENT TYPE *</Text><View style={styles.chipRow}>{(['paid','partial','credit'] as SalePaymentType[]).map(value => <TouchableOpacity key={value} style={[styles.paymentTypeChip,paymentType===value&&styles.paymentTypeChipOn]} onPress={() => setPaymentType(value)}><Text style={[styles.paymentTypeText,paymentType===value&&styles.chipTextOn]}>{value[0].toUpperCase()+value.slice(1)}</Text></TouchableOpacity>)}</View>{paymentType === 'partial' ? <><Text style={styles.label}>AMOUNT RECEIVED *</Text><TextInput style={styles.input} value={received} onChangeText={setReceived} keyboardType="decimal-pad" placeholder="Enter amount received" /></> : paymentType === 'credit' ? <Text style={styles.creditHint}>The complete sale amount will be added to this customer’s outstanding balance.</Text> : null}</> : <><Text style={styles.label}>CATEGORY *</Text><View style={styles.wrapRow}>{CATEGORIES.map(value => <TouchableOpacity key={value} onPress={() => setCategory(value)} style={[styles.smallChip, category === value && styles.expenseChipOn]}><Text style={[styles.smallChipText, category === value && styles.chipTextOn]}>{value[0].toUpperCase()+value.slice(1)}</Text></TouchableOpacity>)}</View><Text style={styles.label}>AMOUNT *</Text><TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="₹0" /><Text style={styles.label}>PAID TO</Text><TextInput style={styles.input} value={payee} onChangeText={setPayee} placeholder="Optional" /></>}
          {entryMode === 'expense' || paymentType !== 'credit' ? <><Text style={styles.label}>{entryMode === 'sale' ? 'RECEIVED USING' : 'PAID USING'} *</Text><MethodPicker /></> : null}<Text style={styles.label}>NOTE</Text><TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Optional" /><Text style={styles.label}>REFERENCE (OPTIONAL)</Text><TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="UPI or bank reference" /><TouchableOpacity disabled={saving} style={[styles.saveButton, entryMode === 'expense' && styles.saveExpense]} onPress={() => { entryMode === 'sale' ? void saveSale() : void saveExpense(); }}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save {entryMode}</Text>}</TouchableOpacity>
        </View> : null}
        {collecting ? <View style={styles.formCard}><View style={styles.formHeader}><View><Text style={styles.formTitle}>Record payment</Text><Text style={styles.balanceText}>Due {formatMoney(collecting.balance,0)} · {collecting.title}</Text></View><TouchableOpacity onPress={() => { setCollecting(null); setAmount(''); }}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity></View><Text style={styles.label}>AMOUNT *</Text><TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="₹0" /><Text style={styles.label}>RECEIVED USING *</Text><MethodPicker /><Text style={styles.label}>REFERENCE (OPTIONAL)</Text><TextInput style={styles.input} value={reference} onChangeText={setReference} /><TouchableOpacity style={styles.saveButton} onPress={() => { void collectPayment(); }}><Text style={styles.saveText}>Save payment</Text></TouchableOpacity></View> : null}
        {outstandingSales.length > 0 ? <View style={styles.outstandingCard}><View style={styles.outstandingHeader}><Text style={styles.sectionTitle}>Outstanding credits</Text><Text style={styles.outstandingCount}>{outstandingSales.length}</Text></View>{outstandingSales.map(sale => <View key={sale.id} style={styles.outstandingRow}><View style={styles.entryCopy}><Text style={styles.entryTitle}>{sale.title}</Text><Text style={styles.entryDetail}>{sale.detail}</Text></View><View style={styles.entryAmount}><Text style={styles.dueValue}>{formatMoney(sale.balance,0)}</Text><TouchableOpacity onPress={() => { setEntryMode(null); setAmount(''); setReference(''); setCollecting(sale); }}><Text style={styles.collect}>Collect</Text></TouchableOpacity></View></View>)}</View> : null}
        <View style={styles.listHeader}><Text style={styles.sectionTitle}>Activity</Text><View style={styles.filterRow}>{(['all','sale','expense'] as Filter[]).map(value => <TouchableOpacity key={value} onPress={() => setFilter(value)} style={[styles.filterChip, filter === value && styles.filterOn]}><Text style={[styles.filterText, filter === value && styles.filterTextOn]}>{value === 'all' ? 'All' : value === 'sale' ? 'Sales' : 'Expenses'}</Text></TouchableOpacity>)}</View></View>
        {loading ? <ActivityIndicator color="#0E7490" style={styles.loader} /> : visibleEntries.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No money activity for this date</Text></View> : visibleEntries.map(entry => <View key={`${entry.entry_type}-${entry.id}`} style={styles.entryRow}><View style={[styles.entryIcon, entry.entry_type === 'expense' && styles.expenseIcon]}><Text style={styles.entryIconText}>{entry.entry_type === 'sale' ? '+' : '−'}</Text></View><View style={styles.entryCopy}><Text style={styles.entryTitle}>{entry.title}</Text><Text style={styles.entryDetail}>{entry.detail}</Text>{entry.balance > 0 ? <Text style={styles.dueText}>Due {formatMoney(entry.balance,0)}</Text> : entry.entry_type === 'sale' ? <Text style={styles.paidText}>Paid</Text> : null}</View><View style={styles.entryAmount}><Text style={[styles.entryValue, entry.entry_type === 'expense' && styles.entryExpense]}>{entry.entry_type === 'expense' ? '−' : '+'}{formatMoney(entry.amount,0)}</Text>{entry.balance > 0 ? <TouchableOpacity onPress={() => { setEntryMode(null); setAmount(''); setReference(''); setCollecting(entry); }}><Text style={styles.collect}>Collect</Text></TouchableOpacity> : null}<TouchableOpacity onPress={() => voidEntry(entry)}><Text style={styles.voidText}>Void</Text></TouchableOpacity></View></View>)}
      </ScrollView>
    </> : <ScrollView style={styles.content} contentContainerStyle={styles.contentBody}>
      <View style={styles.periodRow}>{(['today','7days','month'] as Period[]).map(value => <TouchableOpacity key={value} onPress={() => setPeriod(value)} style={[styles.periodChip, period === value && styles.periodOn]}><Text style={[styles.periodText, period === value && styles.periodTextOn]}>{value === 'today' ? 'Today' : value === '7days' ? '7 days' : 'This month'}</Text></TouchableOpacity>)}</View>
      {loading ? <ActivityIndicator color="#0E7490" style={styles.loader} /> : <><View style={styles.heroCard}><Text style={styles.heroLabel}>NET RESULT</Text><Text style={[styles.heroValue, summary.net < 0 && styles.negative]}>{formatMoney(summary.net,0)}</Text><Text style={styles.heroSub}>{summary.blocks} blocks sold</Text></View><View style={styles.metricGrid}><View style={styles.metricCard}><Text style={styles.metricLabel}>SALES</Text><Text style={styles.metricSales}>{formatMoney(summary.sales,0)}</Text></View><View style={styles.metricCard}><Text style={styles.metricLabel}>EXPENSES</Text><Text style={styles.metricExpenses}>{formatMoney(summary.expenses,0)}</Text></View><View style={styles.metricCard}><Text style={styles.metricLabel}>RECEIVED</Text><Text style={styles.metricValue}>{formatMoney(summary.received,0)}</Text></View><View style={styles.metricCard}><Text style={styles.metricLabel}>OUTSTANDING</Text><Text style={styles.metricValue}>{formatMoney(summary.outstanding,0)}</Text></View></View><View style={styles.breakdownCard}><Text style={styles.sectionTitle}>Money received</Text>{METHODS.map(value => <View key={value} style={styles.breakdownRow}><Text style={styles.breakdownLabel}>{value === 'bank' ? 'Bank' : value.toUpperCase()}</Text><Text style={styles.breakdownValue}>{formatMoney(summary[value],0)}</Text></View>)}</View></>}
    </ScrollView>}
    <SearchableSelectModal visible={showCustomers} title="Select Ice Plant customer" searchPlaceholder="Search customer name" options={customerOptions} emptyMessage="No matching customer" createLabel="+ Create new customer" onCreate={() => { setShowCustomers(false); setShowCreateCustomer(true); }} onSelect={id => setCustomerId(id === 0 ? null : id)} onClose={() => setShowCustomers(false)} />
    <IceCustomerCreateModal visible={showCreateCustomer} saving={saving} onClose={() => setShowCreateCustomer(false)} onSave={createCustomer} />
  </View>;
}
