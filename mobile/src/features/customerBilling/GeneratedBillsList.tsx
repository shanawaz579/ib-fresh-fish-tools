import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Bill, Customer } from '../../types';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type Props = {
  bills: Bill[];
  customers: Customer[];
  loading: boolean;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number, number: string) => void;
};

export default function GeneratedBillsList(props: Props) {
  const { formatMoney } = useBusinessConfig();
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}><Text style={styles.heading}>Bills for this date</Text><View style={styles.count}><Text style={styles.countText}>{props.bills.length}</Text></View></View>
      {props.loading ? <ActivityIndicator color="#0F766E" /> : props.bills.length === 0 ? <Text style={styles.empty}>No bills created yet</Text> : props.bills.map(bill => {
        const customer = props.customers.find(item => item.id === bill.customer_id);
        return (
          <View key={bill.id} style={styles.row}>
            <TouchableOpacity style={styles.main} onPress={() => props.onView(bill.id)}>
              <View style={styles.initial}><Text style={styles.initialText}>{customer?.name?.slice(0, 1).toUpperCase() || '?'}</Text></View>
              <View style={styles.copy}><Text style={styles.customer} numberOfLines={1}>{customer?.name || 'Unknown customer'}</Text><Text style={styles.number}>{bill.bill_number} · {bill.status === 'paid' ? 'Paid' : 'Unpaid'}</Text></View>
              <Text style={styles.total}>{formatMoney(Number(bill.total), 0)}</Text>
            </TouchableOpacity>
            <View style={styles.actions}><TouchableOpacity onPress={() => props.onView(bill.id)}><Text style={styles.action}>View</Text></TouchableOpacity><TouchableOpacity onPress={() => props.onEdit(bill.id)}><Text style={styles.action}>Edit</Text></TouchableOpacity><TouchableOpacity onPress={() => props.onDelete(bill.id, bill.bill_number)}><Text style={styles.delete}>Delete</Text></TouchableOpacity></View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22 },
  headingRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 },
  heading: { color: '#0F172A', fontSize: 17, fontWeight: '800' },
  count: { alignItems: 'center', backgroundColor: '#E2E8F0', borderRadius: 10, height: 20, justifyContent: 'center', marginLeft: 7, minWidth: 20, paddingHorizontal: 5 },
  countText: { color: '#475569', fontSize: 11, fontWeight: '800' },
  empty: { color: '#94A3B8', fontSize: 13, paddingVertical: 20, textAlign: 'center' },
  row: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 13, borderWidth: 1, marginBottom: 9, padding: 11 },
  main: { alignItems: 'center', flexDirection: 'row' },
  initial: { alignItems: 'center', backgroundColor: '#CCFBF1', borderRadius: 9, height: 36, justifyContent: 'center', width: 36 },
  initialText: { color: '#0F766E', fontSize: 15, fontWeight: '900' },
  copy: { flex: 1, marginLeft: 10 },
  customer: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  number: { color: '#64748B', fontSize: 11, marginTop: 2 },
  total: { color: '#0F766E', fontSize: 16, fontWeight: '900' },
  actions: { borderTopColor: '#F1F5F9', borderTopWidth: 1, flexDirection: 'row', gap: 20, justifyContent: 'flex-end', marginTop: 9, paddingTop: 8 },
  action: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  delete: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
});
