import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SearchableSelectModal, { type SearchableOption } from '../../components/SearchableSelectModal';
import type { Customer } from '../../types';

export default function PaymentCustomerSelector({ customers, selected, onSelect }: { customers: Customer[]; selected?: Customer; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const options = useMemo<SearchableOption[]>(() => customers.map(customer => ({
    id: customer.id, label: customer.name,
    detail: [customer.phone, customer.city].filter(Boolean).join(' · ') || undefined,
  })), [customers]);
  return (
    <>
      <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)}>
        <View style={styles.copy}><Text style={styles.label}>CUSTOMER ACCOUNT</Text><Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>{selected?.name ?? 'Search customer'}</Text>{selected?.city ? <Text style={styles.detail}>{selected.city}</Text> : null}</View>
        <Text style={styles.chevron}>⌄</Text>
      </TouchableOpacity>
      <SearchableSelectModal visible={open} title="Select customer" searchPlaceholder="Search name, phone or area" options={options} emptyMessage="No matching customer" onSelect={onSelect} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  selector: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DDE5E7', borderRadius: 16, borderWidth: 1, flexDirection: 'row', minHeight: 68, paddingHorizontal: 15 },
  copy: { flex: 1 }, label: { color: '#64748B', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  value: { color: '#0F172A', fontSize: 17, fontWeight: '800', marginTop: 4 }, placeholder: { color: '#64748B', fontWeight: '500' },
  detail: { color: '#94A3B8', fontSize: 11, marginTop: 2 }, chevron: { color: '#475569', fontSize: 22 },
});
