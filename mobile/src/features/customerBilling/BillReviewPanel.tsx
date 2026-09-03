import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { BillOtherCharge } from '../../types';
import OtherChargesSection from '../../components/OtherChargesSection';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
type QuickPayment = { amount: number; payment_method: PaymentMethod };

type Props = {
  previousBalance: number;
  itemsTotal: number;
  chargesTotal: number;
  currentBillTotal: number;
  quickPaymentsTotal: number;
  total: number;
  otherCharges: BillOtherCharge[];
  onChargesChange: (charges: BillOtherCharge[]) => void;
  quickPayments: QuickPayment[];
  newPaymentAmount: string;
  onPaymentAmountChange: (value: string) => void;
  newPaymentMethod: PaymentMethod;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  onAddPayment: () => void;
  onRemovePayment: (index: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  markAsPaid: boolean;
  onMarkAsPaidChange: (value: boolean) => void;
  submitting: boolean;
  editing: boolean;
  correctionReason: string;
  onCorrectionReasonChange: (value: string) => void;
  allRatesSet: boolean;
  onSubmit: () => void;
};

function Disclosure({ title, meta, open, onPress }: { title: string; meta: string; open: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.disclosure} onPress={onPress}>
      <View><Text style={styles.disclosureTitle}>{title}</Text><Text style={styles.disclosureMeta}>{meta}</Text></View>
      <Text style={styles.disclosureIcon}>{open ? '−' : '+'}</Text>
    </TouchableOpacity>
  );
}

export default function BillReviewPanel(props: Props) {
  const { configuration, formatMoney } = useBusinessConfig();
  const [chargesOpen, setChargesOpen] = useState(props.otherCharges.length > 0);
  const [paymentOpen, setPaymentOpen] = useState(props.quickPayments.length > 0);
  const [notesOpen, setNotesOpen] = useState(Boolean(props.notes));
  const missingRate = !props.allRatesSet;
  const missingCorrectionReason = props.editing && props.correctionReason.trim().length < 5;
  const methods: Array<{ value: PaymentMethod; label: string }> = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank' },
    { value: 'cheque', label: 'Cheque' },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.stepRow}>
        <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
        <View><Text style={styles.title}>Review & save</Text><Text style={styles.subtitle}>Optional charges and payment can be added here</Text></View>
      </View>

      <Disclosure title="Charges & deductions" meta={props.chargesTotal ? `${formatMoney(props.chargesTotal, 0)} applied` : 'Optional'} open={chargesOpen} onPress={() => setChargesOpen(value => !value)} />
      {chargesOpen ? <View style={styles.expanded}><OtherChargesSection charges={props.otherCharges} onChargesChange={props.onChargesChange} /></View> : null}

      <Disclosure title="Payment received now" meta={props.quickPaymentsTotal ? `${formatMoney(props.quickPaymentsTotal, 0)} recorded` : 'Optional'} open={paymentOpen} onPress={() => setPaymentOpen(value => !value)} />
      {paymentOpen ? (
        <View style={styles.expanded}>
          {props.quickPayments.map((payment, index) => (
            <View key={`${payment.payment_method}-${index}`} style={styles.paymentItem}>
              <View><Text style={styles.paymentAmount}>{formatMoney(payment.amount, 0)}</Text><Text style={styles.paymentMethod}>{payment.payment_method.replace('_', ' ').toUpperCase()}</Text></View>
              <TouchableOpacity style={styles.removeButton} onPress={() => props.onRemovePayment(index)}><Text style={styles.removeText}>Remove</Text></TouchableOpacity>
            </View>
          ))}
          <View style={styles.paymentMethods}>{methods.map(method => <TouchableOpacity key={method.value} style={[styles.methodChip, props.newPaymentMethod === method.value && styles.methodChipActive]} onPress={() => props.onPaymentMethodChange(method.value)}><Text style={[styles.methodText, props.newPaymentMethod === method.value && styles.methodTextActive]}>{method.label}</Text></TouchableOpacity>)}</View>
          <View style={styles.paymentEntry}>
            <View style={styles.amountInputWrap}><Text style={styles.currency}>{configuration.preferences.currency_symbol}</Text><TextInput style={styles.amountInput} value={props.newPaymentAmount} onChangeText={props.onPaymentAmountChange} placeholder="Amount received" keyboardType="decimal-pad" /></View>
            <TouchableOpacity style={styles.addButton} onPress={props.onAddPayment}><Text style={styles.addButtonText}>Add</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Disclosure title="Bill note" meta={props.notes ? 'Note added' : 'Optional'} open={notesOpen} onPress={() => setNotesOpen(value => !value)} />
      {notesOpen ? <TextInput style={styles.notesInput} multiline value={props.notes} onChangeText={props.onNotesChange} placeholder="Add a note visible on this bill" textAlignVertical="top" /> : null}

      {props.editing ? (
        <View style={styles.correctionBox}>
          <Text style={styles.correctionTitle}>WHY IS THIS BILL BEING CORRECTED? *</Text>
          <Text style={styles.correctionMeta}>The original bill remains in audit history. Payments must be voided before changing financial values.</Text>
          <TextInput
            style={styles.correctionInput}
            multiline
            value={props.correctionReason}
            onChangeText={props.onCorrectionReasonChange}
            placeholder="Example: wrong selling rate entered"
            textAlignVertical="top"
          />
        </View>
      ) : null}

      <View style={styles.summary}>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Items</Text><Text style={styles.summaryValue}>{formatMoney(props.itemsTotal, 0)}</Text></View>
        {props.chargesTotal !== 0 ? <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Charges / deductions</Text><Text style={styles.summaryValue}>{props.chargesTotal > 0 ? '+' : '−'}{formatMoney(Math.abs(props.chargesTotal), 0)}</Text></View> : null}
        <View style={styles.currentBillRow}><Text style={styles.currentBillLabel}>THIS BILL</Text><Text style={styles.currentBillValue}>{formatMoney(props.currentBillTotal, 0)}</Text></View>
        {props.previousBalance !== 0 ? <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Balance brought forward</Text><Text style={styles.summaryValue}>{formatMoney(props.previousBalance, 0)}</Text></View> : null}
        {props.quickPaymentsTotal > 0 ? <View style={styles.summaryRow}><Text style={styles.paymentSummaryLabel}>Payment now</Text><Text style={styles.paymentSummaryValue}>−{formatMoney(props.quickPaymentsTotal, 0)}</Text></View> : null}
        <View style={styles.totalRow}><View><Text style={styles.totalLabel}>{props.total < 0 ? 'CUSTOMER CREDIT' : 'TOTAL DUE'}</Text><Text style={styles.totalHint}>After balance and payment</Text></View><Text style={styles.totalValue}>{formatMoney(Math.abs(props.total), 0)}</Text></View>
      </View>

      <TouchableOpacity style={styles.paidRow} onPress={() => props.onMarkAsPaidChange(!props.markAsPaid)}>
        <View style={[styles.checkbox, props.markAsPaid && styles.checkboxOn]}>{props.markAsPaid ? <Text style={styles.checkmark}>✓</Text> : null}</View>
        <View style={styles.paidCopy}><Text style={styles.paidTitle}>Paid in full</Text><Text style={styles.paidMeta}>Close this bill with no balance due</Text></View>
      </TouchableOpacity>

      {missingRate ? <Text style={styles.rateWarning}>Enter a selling rate for every item to continue.</Text> : null}
      {missingCorrectionReason ? <Text style={styles.rateWarning}>Enter a correction reason of at least 5 characters.</Text> : null}
      <TouchableOpacity style={[styles.submitButton, (props.submitting || missingRate || missingCorrectionReason) && styles.submitDisabled]} disabled={props.submitting || missingRate || missingCorrectionReason} onPress={props.onSubmit}>
        {props.submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{props.editing ? 'Save bill changes' : `Create bill · ${formatMoney(props.total, 0)}`}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 18, borderWidth: 1, padding: 16 },
  stepRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 12 },
  stepBadge: { alignItems: 'center', backgroundColor: '#0F766E', borderRadius: 12, height: 24, justifyContent: 'center', marginRight: 10, width: 24 },
  stepBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  title: { color: '#0F172A', fontSize: 17, fontWeight: '800' },
  subtitle: { color: '#64748B', fontSize: 12, marginTop: 1 },
  disclosure: { alignItems: 'center', borderTopColor: '#F1F5F9', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58 },
  disclosureTitle: { color: '#334155', fontSize: 14, fontWeight: '700' },
  disclosureMeta: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  disclosureIcon: { color: '#0F766E', fontSize: 22, fontWeight: '500' },
  expanded: { backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 10, padding: 10 },
  paymentItem: { alignItems: 'center', borderBottomColor: '#E2E8F0', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  paymentAmount: { color: '#047857', fontSize: 14, fontWeight: '800' },
  paymentMethod: { color: '#64748B', fontSize: 9, fontWeight: '700', marginTop: 2 },
  removeButton: { padding: 6 },
  removeText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  paymentEntry: { flexDirection: 'row', gap: 7, marginTop: 10 },
  amountInputWrap: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: 9, borderWidth: 1, flex: 1.25, flexDirection: 'row', height: 44, paddingHorizontal: 9 },
  currency: { color: '#64748B', fontWeight: '700' },
  amountInput: { color: '#0F172A', flex: 1, fontSize: 14, paddingHorizontal: 5 },
  paymentMethods: { flexDirection: 'row', gap: 6, marginTop: 10 },
  methodChip: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#CBD5E1', borderRadius: 8, borderWidth: 1, flex: 1, paddingVertical: 8 },
  methodChipActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  methodText: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  methodTextActive: { color: '#FFF' },
  addButton: { alignItems: 'center', backgroundColor: '#0F766E', borderRadius: 9, justifyContent: 'center', paddingHorizontal: 13 },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  notesInput: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', borderRadius: 10, borderWidth: 1, color: '#0F172A', minHeight: 76, padding: 11 },
  correctionBox: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 12 },
  correctionTitle: { color: '#9A3412', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  correctionMeta: { color: '#C2410C', fontSize: 10, lineHeight: 15, marginTop: 4 },
  correctionInput: { backgroundColor: '#FFFFFF', borderColor: '#FDBA74', borderRadius: 9, borderWidth: 1, color: '#0F172A', marginTop: 9, minHeight: 70, padding: 10 },
  summary: { backgroundColor: '#F8FAFC', borderRadius: 13, marginTop: 14, padding: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: '#64748B', fontSize: 13 },
  summaryValue: { color: '#334155', fontSize: 13, fontWeight: '700' },
  currentBillRow: { borderTopColor: '#E2E8F0', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingTop: 9 },
  currentBillLabel: { color: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  currentBillValue: { color: '#0F766E', fontSize: 15, fontWeight: '900' },
  paymentSummaryLabel: { color: '#047857', fontSize: 13 },
  paymentSummaryValue: { color: '#047857', fontSize: 13, fontWeight: '800' },
  totalRow: { alignItems: 'center', borderTopColor: '#CBD5E1', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 3, paddingTop: 12 },
  totalLabel: { color: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  totalHint: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  totalValue: { color: '#0F766E', fontSize: 24, fontWeight: '900' },
  paidRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 14 },
  checkbox: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#94A3B8', borderRadius: 6, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  checkboxOn: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  paidCopy: { marginLeft: 10 },
  paidTitle: { color: '#334155', fontSize: 14, fontWeight: '700' },
  paidMeta: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  rateWarning: { color: '#B45309', fontSize: 12, fontWeight: '600', marginBottom: 9, textAlign: 'center' },
  submitButton: { alignItems: 'center', backgroundColor: '#0F766E', borderRadius: 12, minHeight: 52, justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
