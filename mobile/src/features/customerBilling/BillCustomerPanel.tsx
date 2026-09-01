import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Bill, Customer } from '../../types';
import SearchableSelectModal, { type SearchableOption } from '../../components/SearchableSelectModal';
import CustomerCreateModal from '../sales/CustomerCreateModal';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type Props = {
  customers: Customer[];
  selectedCustomer: Customer | undefined;
  existingBill?: Bill;
  totalOutstanding: number;
  unpaidBillsCount: number;
  oldestBillDate: string | null;
  onSelect: (id: number) => void;
  onCreated: (customer: Customer) => void;
  onViewExisting: (billId: number) => void;
  onEditExisting: (billId: number) => void;
};

export default function BillCustomerPanel(props: Props) {
  const { formatMoney } = useBusinessConfig();
  const [showSelector, setShowSelector] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const options = useMemo<SearchableOption[]>(() => props.customers.map(customer => ({
    id: customer.id,
    label: customer.name,
    detail: [customer.phone, customer.city].filter(Boolean).join(' · ') || undefined,
    searchText: [customer.business_type, customer.contact_person].filter(Boolean).join(' '),
  })), [props.customers]);

  return (
    <View style={styles.card}>
      <View style={styles.stepRow}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
        <View style={styles.stepCopy}>
          <Text style={styles.title}>Customer</Text>
          <Text style={styles.subtitle}>Choose who this bill belongs to</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.selector} onPress={() => setShowSelector(true)}>
        <View style={styles.selectorCopy}>
          <Text style={styles.selectorLabel}>CUSTOMER</Text>
          <Text style={[styles.selectorValue, !props.selectedCustomer && styles.placeholder]} numberOfLines={1}>
            {props.selectedCustomer?.name ?? 'Search or choose customer'}
          </Text>
          {props.selectedCustomer && (props.selectedCustomer.phone || props.selectedCustomer.city) ? (
            <Text style={styles.selectorDetail}>{[props.selectedCustomer.phone, props.selectedCustomer.city].filter(Boolean).join(' · ')}</Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>⌄</Text>
      </TouchableOpacity>

      {props.selectedCustomer && !props.existingBill ? (
        props.totalOutstanding > 0 ? (
          <View style={styles.dueBanner}>
            <View>
              <Text style={styles.dueLabel}>PREVIOUS BALANCE</Text>
              <Text style={styles.dueMeta}>{props.unpaidBillsCount} unpaid bill{props.unpaidBillsCount === 1 ? '' : 's'}</Text>
            </View>
            <Text style={styles.dueAmount}>{formatMoney(props.totalOutstanding, 0)}</Text>
          </View>
        ) : (
          <View style={styles.clearBanner}>
            <Text style={styles.clearIcon}>✓</Text>
            <View><Text style={styles.clearTitle}>Account clear</Text><Text style={styles.clearText}>No previous balance</Text></View>
          </View>
        )
      ) : null}

      {props.existingBill ? (
        <View style={styles.existingBanner}>
          <View style={styles.existingCopy}>
            <Text style={styles.existingTitle}>Bill already created</Text>
            <Text style={styles.existingText}>{props.existingBill.bill_number} · {formatMoney(Number(props.existingBill.total), 0)}</Text>
          </View>
          <TouchableOpacity onPress={() => props.onViewExisting(props.existingBill!.id)}><Text style={styles.viewLink}>View</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => props.onEditExisting(props.existingBill!.id)}><Text style={styles.editLink}>Edit</Text></TouchableOpacity>
        </View>
      ) : null}

      <SearchableSelectModal
        visible={showSelector}
        title="Select customer"
        searchPlaceholder="Search name, phone or area"
        options={options}
        emptyMessage="No matching customer"
        createLabel="+ Create customer"
        onSelect={props.onSelect}
        onCreate={() => { setShowSelector(false); setShowCreate(true); }}
        onClose={() => setShowSelector(false)}
      />
      <CustomerCreateModal
        visible={showCreate}
        onCreated={props.onCreated}
        onClose={() => setShowCreate(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 18, borderWidth: 1, padding: 16 },
  stepRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 14 },
  stepBadge: { alignItems: 'center', backgroundColor: '#0F766E', borderRadius: 12, height: 24, justifyContent: 'center', width: 24 },
  stepBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  stepCopy: { marginLeft: 10 },
  title: { color: '#0F172A', fontSize: 17, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 12, marginTop: 1 },
  selector: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 66, paddingHorizontal: 14 },
  selectorCopy: { flex: 1 },
  selectorLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  selectorValue: { color: '#0F172A', fontSize: 16, fontWeight: '700', marginTop: 4 },
  selectorDetail: { color: '#64748B', fontSize: 12, marginTop: 2 },
  placeholder: { color: '#64748B', fontWeight: '500' },
  chevron: { color: '#475569', fontSize: 22, marginLeft: 10 },
  clearBanner: { alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, flexDirection: 'row', marginTop: 10, padding: 10 },
  clearIcon: { color: '#047857', fontSize: 16, fontWeight: '900', marginHorizontal: 5, marginRight: 11 },
  clearTitle: { color: '#065F46', fontSize: 13, fontWeight: '800' },
  clearText: { color: '#047857', fontSize: 11, marginTop: 1 },
  dueBanner: { alignItems: 'center', backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, padding: 11 },
  dueLabel: { color: '#9A3412', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  dueMeta: { color: '#C2410C', fontSize: 11, marginTop: 2 },
  dueAmount: { color: '#9A3412', fontSize: 18, fontWeight: '900' },
  existingBanner: { alignItems: 'center', backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderRadius: 10, borderWidth: 1, flexDirection: 'row', marginTop: 10, padding: 11 },
  existingCopy: { flex: 1 },
  existingTitle: { color: '#1E3A8A', fontSize: 13, fontWeight: '800' },
  existingText: { color: '#1D4ED8', fontSize: 11, marginTop: 2 },
  viewLink: { color: '#1D4ED8', fontSize: 13, fontWeight: '800', marginLeft: 12 },
  editLink: { color: '#B45309', fontSize: 13, fontWeight: '800', marginLeft: 12 },
});
