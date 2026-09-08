import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { BillItemForm } from '../../domain/customerBilling';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type Props = {
  item: BillItemForm;
  amount: number;
  onChangeCrateWeight: (value: string) => void;
  onChangeRate: (value: string) => void;
  editing?: boolean;
  onChangeItem?: () => void;
  onChangeCrates?: (value: string) => void;
  onChangeKg?: (value: string) => void;
  onRemove?: () => void;
};

export default function BillItemRateCard({ item, amount, onChangeCrateWeight, onChangeRate, editing, onChangeItem, onChangeCrates, onChangeKg, onRemove }: Props) {
  const { configuration, formatMoney } = useBusinessConfig();
  const hasCrates = item.quantity_crates > 0;
  const qty = [hasCrates ? `${item.quantity_crates} cr` : '', item.quantity_kg > 0 ? `${item.quantity_kg} kg` : ''].filter(Boolean).join(' · ');
  const rateMissing = item.rate_per_kg <= 0;
  const formattedWeight = item.total_weight.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.nameWrap}><Text style={styles.name} numberOfLines={1}>{item.fish_variety_name}</Text><Text style={styles.quantity}>{qty}</Text></View>
        {editing ? <View style={styles.headerActions}><TouchableOpacity onPress={onChangeItem}><Text style={styles.changeText}>Change</Text></TouchableOpacity><TouchableOpacity onPress={onRemove}><Text style={styles.removeText}>Remove</Text></TouchableOpacity></View> : null}
      </View>

      {editing ? <View style={styles.quantityEditRow}>
        <View style={styles.quantityEditField}><Text style={styles.fieldLabel}>CRATES</Text><TextInput style={styles.quantityInput} keyboardType="number-pad" value={item.quantity_crates ? String(item.quantity_crates) : ''} onChangeText={onChangeCrates} placeholder="0" /></View>
        <View style={styles.quantityEditField}><Text style={styles.fieldLabel}>KG</Text><TextInput style={styles.quantityInput} keyboardType="decimal-pad" value={item.quantity_kg ? String(item.quantity_kg) : ''} onChangeText={onChangeKg} placeholder="0" /></View>
      </View> : null}

      {hasCrates ? (
        <View style={styles.conversionRow}>
          <Text style={styles.conversionLabel}>CRATE WEIGHT</Text>
          <View style={styles.conversionFormula}>
            <Text style={styles.formulaText}>{item.quantity_crates} cr</Text>
            <Text style={styles.formulaOperator}>×</Text>
            <TextInput style={styles.crateWeightInput} keyboardType="decimal-pad" value={String(item.crate_weight || '')} onChangeText={onChangeCrateWeight} selectTextOnFocus />
            <Text style={styles.formulaUnit}>kg/cr</Text>
            {item.quantity_kg > 0 ? <Text style={styles.formulaText}>+ {item.quantity_kg} kg</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.fieldsRow}>
        <View style={styles.weightField}>
          <Text style={styles.fieldLabel}>TOTAL WEIGHT</Text>
          <View style={styles.weightBox}>
            <Text style={styles.weightValue}>{formattedWeight}</Text>
            <Text style={styles.weightUnit}>kg</Text>
          </View>
        </View>
        <View style={styles.rateField}>
          <Text style={styles.fieldLabel}>SELLING RATE</Text>
          <View style={[styles.rateInputWrap, rateMissing && styles.rateInputMissing]}>
            <Text style={styles.currency}>{configuration.preferences.currency_symbol}</Text>
            <TextInput style={styles.rateInput} keyboardType="number-pad" maxLength={3} placeholder="Rate" placeholderTextColor="#94A3B8" value={item.rate_per_kg > 0 ? String(item.rate_per_kg) : ''} onChangeText={value => onChangeRate(value.replace(/\D/g, '').slice(0, 3))} selectTextOnFocus />
            <Text style={styles.perKg}>/ kg</Text>
          </View>
        </View>
      </View>

      <View style={styles.resultStrip}>
        <Text style={styles.calculationText}>{rateMissing ? 'Enter the selling rate' : `${formattedWeight} kg × ${configuration.preferences.currency_symbol}${item.rate_per_kg}/kg`}</Text>
        <View style={styles.amountWrap}><Text style={styles.amountLabel}>AMOUNT</Text><Text style={[styles.amount, rateMissing && styles.amountPending]}>{rateMissing ? '—' : formatMoney(amount, 0)}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden', paddingHorizontal: 14, paddingTop: 13 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  nameWrap: { flex: 1 },
  name: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  quantity: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 3 },
  headerActions: { flexDirection: 'row', gap: 12, marginLeft: 10 },
  changeText: { color: '#0369A1', fontSize: 11, fontWeight: '800' },
  removeText: { color: '#B91C1C', fontSize: 11, fontWeight: '800' },
  quantityEditRow: { flexDirection: 'row', gap: 9, marginTop: 11 },
  quantityEditField: { flex: 1 },
  quantityInput: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', borderRadius: 8, borderWidth: 1, color: '#0F172A', fontSize: 14, fontWeight: '800', height: 40, paddingHorizontal: 10 },
  conversionRow: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderRadius: 9, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, minHeight: 42, paddingHorizontal: 10 },
  conversionLabel: { color: '#64748B', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  conversionFormula: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  formulaText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  formulaOperator: { color: '#94A3B8', fontSize: 12, fontWeight: '800' },
  crateWeightInput: { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: 7, borderWidth: 1, color: '#0F172A', fontSize: 14, fontWeight: '900', height: 32, minWidth: 48, paddingHorizontal: 7, paddingVertical: 0, textAlign: 'center' },
  formulaUnit: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  amountWrap: { alignItems: 'flex-end' },
  amountLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  amount: { color: '#047857', fontSize: 18, fontWeight: '900', marginTop: 2 },
  amountPending: { color: '#94A3B8' },
  fieldsRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 10, marginTop: 12 },
  fieldLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginBottom: 5 },
  weightField: { flex: 1 },
  weightBox: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', borderRadius: 9, borderWidth: 1, flexDirection: 'row', height: 44, justifyContent: 'space-between', paddingHorizontal: 11 },
  weightValue: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  weightUnit: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  rateField: { width: 118 },
  rateInputWrap: { alignItems: 'center', backgroundColor: '#F0FDFA', borderColor: '#5EEAD4', borderRadius: 9, borderWidth: 1.5, flexDirection: 'row', height: 44, paddingHorizontal: 11 },
  rateInputMissing: { backgroundColor: '#FFFBEB', borderColor: '#FBBF24' },
  currency: { color: '#0F766E', fontSize: 16, fontWeight: '900' },
  rateInput: { color: '#0F172A', flex: 1, fontSize: 17, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 0 },
  perKg: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  resultStrip: { alignItems: 'center', borderTopColor: '#F1F5F9', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, minHeight: 52, paddingVertical: 8 },
  calculationText: { color: '#64748B', flex: 1, fontSize: 10, fontWeight: '700', paddingRight: 10 },
});
