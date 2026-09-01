import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { BillItemForm } from '../../domain/customerBilling';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type Props = {
  item: BillItemForm;
  amount: number;
  onChangeCrateWeight: (value: string) => void;
  onChangeRate: (value: string) => void;
};

export default function BillItemRateCard({ item, amount, onChangeCrateWeight, onChangeRate }: Props) {
  const { configuration, formatMoney } = useBusinessConfig();
  const hasCrates = item.quantity_crates > 0;
  const qty = [hasCrates ? `${item.quantity_crates} cr` : '', item.quantity_kg > 0 ? `${item.quantity_kg} kg` : ''].filter(Boolean).join(' + ');
  const rateMissing = item.rate_per_kg <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.nameWrap}><Text style={styles.name} numberOfLines={1}>{item.fish_variety_name}</Text><Text style={styles.quantity}>{qty}</Text></View>
        <View style={styles.amountWrap}><Text style={styles.amountLabel}>AMOUNT</Text><Text style={[styles.amount, rateMissing && styles.amountPending]}>{rateMissing ? '—' : formatMoney(amount, 0)}</Text></View>
      </View>

      <View style={styles.fieldsRow}>
        {hasCrates ? (
          <View style={styles.secondaryField}>
            <Text style={styles.fieldLabel}>KG / CRATE</Text>
            <TextInput style={styles.secondaryInput} keyboardType="decimal-pad" value={String(item.crate_weight || '')} onChangeText={onChangeCrateWeight} selectTextOnFocus />
          </View>
        ) : null}
        <View style={styles.rateField}>
          <Text style={styles.fieldLabel}>SELLING RATE</Text>
          <View style={[styles.rateInputWrap, rateMissing && styles.rateInputMissing]}>
            <Text style={styles.currency}>{configuration.preferences.currency_symbol}</Text>
            <TextInput style={styles.rateInput} keyboardType="decimal-pad" placeholder="Enter rate" placeholderTextColor="#94A3B8" value={item.rate_per_kg > 0 ? String(item.rate_per_kg) : ''} onChangeText={onChangeRate} selectTextOnFocus />
            <Text style={styles.perKg}>/ kg</Text>
          </View>
        </View>
      </View>

      <View style={styles.weightStrip}>
        <Text style={styles.weightLabel}>Billable weight</Text>
        <Text style={styles.weightValue}>{item.total_weight.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden', paddingHorizontal: 14, paddingTop: 13 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  nameWrap: { flex: 1, paddingRight: 12 },
  name: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  quantity: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 3 },
  amountWrap: { alignItems: 'flex-end' },
  amountLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  amount: { color: '#047857', fontSize: 18, fontWeight: '900', marginTop: 2 },
  amountPending: { color: '#94A3B8' },
  fieldsRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 10, marginTop: 13 },
  fieldLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginBottom: 5 },
  secondaryField: { width: 86 },
  secondaryInput: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', borderRadius: 9, borderWidth: 1, color: '#334155', fontSize: 15, fontWeight: '700', height: 44, paddingHorizontal: 10, textAlign: 'center' },
  rateField: { flex: 1 },
  rateInputWrap: { alignItems: 'center', backgroundColor: '#F0FDFA', borderColor: '#5EEAD4', borderRadius: 9, borderWidth: 1.5, flexDirection: 'row', height: 44, paddingHorizontal: 11 },
  rateInputMissing: { backgroundColor: '#FFFBEB', borderColor: '#FBBF24' },
  currency: { color: '#0F766E', fontSize: 16, fontWeight: '900' },
  rateInput: { color: '#0F172A', flex: 1, fontSize: 17, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 0 },
  perKg: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  weightStrip: { alignItems: 'center', borderTopColor: '#F1F5F9', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingVertical: 9 },
  weightLabel: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  weightValue: { color: '#0F766E', fontSize: 13, fontWeight: '800' },
});
