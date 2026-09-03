import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Bill, Customer } from '../../types';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type Filter = 'all' | 'unpaid' | 'paid';
type Props = { bills: Bill[]; customers: Customer[]; loading: boolean; onSelectCustomer: (id: number) => void; onCorrect: (bill: Bill) => void };

export default function DailyBillsPanel({ bills, customers, loading, onSelectCustomer, onCorrect }: Props) {
  const { formatMoney } = useBusinessConfig();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const customerNames = useMemo(() => new Map(customers.map(customer => [customer.id, customer.name])), [customers]);
  const counts = useMemo(() => ({ unpaid: bills.filter(bill => bill.status !== 'paid').length, paid: bills.filter(bill => bill.status === 'paid').length }), [bills]);
  const visibleBills = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return bills.filter(bill => {
      if (filter === 'paid' && bill.status !== 'paid') return false;
      if (filter === 'unpaid' && bill.status === 'paid') return false;
      if (!normalized) return true;
      return `${bill.bill_number} ${customerNames.get(bill.customer_id) ?? ''}`.toLocaleLowerCase().includes(normalized);
    });
  }, [bills, customerNames, filter, query]);

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}><View><Text style={styles.title}>Bills for this date</Text><Text style={styles.subtitle}>Tap a bill to record payment</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{bills.length}</Text></View></View>
      <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Search customer or bill number" placeholderTextColor="#94A3B8" />
      <View style={styles.filters}>
        {([
          ['all', `All ${bills.length}`], ['unpaid', `To collect ${counts.unpaid}`], ['paid', `Paid ${counts.paid}`],
        ] as Array<[Filter, string]>).map(([value, label]) => <TouchableOpacity key={value} style={[styles.filter, filter === value && styles.filterOn]} onPress={() => setFilter(value)}><Text style={[styles.filterText, filter === value && styles.filterTextOn]}>{label}</Text></TouchableOpacity>)}
      </View>

      {loading ? <ActivityIndicator color="#0F766E" style={styles.loader} /> : visibleBills.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>{bills.length ? 'No matching bills' : 'No bills for this date'}</Text><Text style={styles.emptyText}>{bills.length ? 'Try another search or filter.' : 'Create sales bills first, or choose another date.'}</Text></View> : visibleBills.map(bill => {
        const customerName = customerNames.get(bill.customer_id) ?? 'Unknown customer';
        const paid = bill.status === 'paid';
        return (
          <View key={bill.id} style={styles.billRow}>
            <TouchableOpacity style={styles.billTapArea} onPress={() => onSelectCustomer(bill.customer_id)}>
            <View style={styles.initial}><Text style={styles.initialText}>{customerName.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.billCopy}><Text style={styles.customer} numberOfLines={1}>{customerName}</Text><Text style={styles.billMeta}>{bill.bill_number}</Text></View>
            <View style={styles.amountCopy}><Text style={styles.amount}>{formatMoney(Number(bill.total), 0)}</Text><Text style={[styles.status, paid ? styles.paid : styles.unpaid]}>{paid ? 'Paid' : 'To collect'}</Text></View>
            <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            {bill.is_active ? <TouchableOpacity style={styles.deleteButton} onPress={() => onCorrect(bill)}><Text style={styles.deleteText}>Correct bill</Text></TouchableOpacity> : <Text style={styles.lockedText}>Historical bill</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 14 }, headingRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 }, title: { color: '#0F172A', fontSize: 17, fontWeight: '900' }, subtitle: { color: '#64748B', fontSize: 11, marginTop: 2 },
  countBadge: { alignItems: 'center', backgroundColor: '#CCFBF1', borderRadius: 12, height: 25, justifyContent: 'center', marginLeft: 'auto', minWidth: 25, paddingHorizontal: 7 }, countText: { color: '#0F766E', fontSize: 11, fontWeight: '900' },
  search: { backgroundColor: '#FFF', borderColor: '#DDE5E7', borderRadius: 11, borderWidth: 1, color: '#0F172A', height: 44, paddingHorizontal: 12 }, filters: { flexDirection: 'row', gap: 7, marginVertical: 9 },
  filter: { backgroundColor: '#E9EEF0', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8 }, filterOn: { backgroundColor: '#0F766E' }, filterText: { color: '#475569', fontSize: 11, fontWeight: '800' }, filterTextOn: { color: '#FFF' },
  loader: { marginVertical: 24 }, empty: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#DDE5E7', borderRadius: 13, borderWidth: 1, padding: 22 }, emptyTitle: { color: '#334155', fontSize: 14, fontWeight: '800' }, emptyText: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  billRow: { backgroundColor: '#FFF', borderColor: '#DDE5E7', borderRadius: 13, borderWidth: 1, marginBottom: 8, padding: 11 }, billTapArea: { alignItems: 'center', flexDirection: 'row' }, initial: { alignItems: 'center', backgroundColor: '#CCFBF1', borderRadius: 9, height: 38, justifyContent: 'center', width: 38 }, initialText: { color: '#0F766E', fontSize: 15, fontWeight: '900' },
  billCopy: { flex: 1, marginLeft: 10 }, customer: { color: '#0F172A', fontSize: 14, fontWeight: '800' }, billMeta: { color: '#64748B', fontSize: 10, marginTop: 2 }, amountCopy: { alignItems: 'flex-end' }, amount: { color: '#0F172A', fontSize: 14, fontWeight: '900' }, status: { fontSize: 9, fontWeight: '800', marginTop: 3 }, paid: { color: '#047857' }, unpaid: { color: '#C2410C' }, chevron: { color: '#94A3B8', fontSize: 22, marginLeft: 8 },
  deleteButton: { alignSelf: 'flex-end', borderTopColor: '#F1F5F9', borderTopWidth: 1, marginTop: 8, paddingHorizontal: 5, paddingTop: 8 }, deleteText: { color: '#DC2626', fontSize: 11, fontWeight: '800' }, lockedText: { alignSelf: 'flex-end', color: '#94A3B8', fontSize: 9, fontWeight: '700', marginTop: 7 },
});
