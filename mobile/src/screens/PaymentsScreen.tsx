import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import DailyBillsPanel from '../features/payments/DailyBillsPanel';
import PaymentCustomerSelector from '../features/payments/PaymentCustomerSelector';
import PaymentVoidModal from '../features/payments/PaymentVoidModal';
import { type PaymentMethod, useCustomerPayments } from '../features/payments/useCustomerPayments';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Payment } from '../types';
import { formatBusinessDate } from '../utils/date';
import styles from '../styles/PaymentsScreen.styles';
import { useBusinessConfig } from '../context/BusinessConfigContext';

const methods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank' }, { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function PaymentsScreen() {
  const { configuration, formatMoney } = useBusinessConfig();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const payment = useCustomerPayments();
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const numericAmount = Number.parseFloat(payment.amount) || 0;
  const balanceAfter = payment.summary.account_balance - numericAmount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}><Text style={styles.backIcon}>‹</Text></TouchableOpacity>
        <View><Text style={styles.eyebrow}>CUSTOMER ACCOUNTS</Text><Text style={styles.title}>Record payment</Text></View>
      </View>
      <DateNavigator date={payment.date} onPrevious={payment.goToPreviousDay} onNext={payment.goToNextDay} onToday={payment.goToToday} accentColor="#0F766E" />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <PaymentCustomerSelector customers={payment.customers} selected={payment.selectedCustomer} onSelect={payment.selectCustomer} />

        {!payment.selectedCustomerId ? (
          <DailyBillsPanel bills={payment.dailyBills} customers={payment.customers} loading={payment.loadingBills} onSelectCustomer={payment.selectCustomer} onDelete={payment.deleteBill} />
        ) : payment.loading ? (
          <View style={styles.loading}><ActivityIndicator color="#0F766E" /><Text style={styles.loadingText}>Loading customer account…</Text></View>
        ) : (
          <>
            <View style={[styles.balanceCard, payment.summary.advance_credit > 0 ? styles.creditCard : payment.summary.outstanding_amount === 0 ? styles.clearCard : null]}>
              <Text style={styles.balanceLabel}>{payment.summary.advance_credit > 0 ? 'ADVANCE CREDIT' : payment.summary.outstanding_amount > 0 ? 'AMOUNT TO COLLECT' : 'ACCOUNT STATUS'}</Text>
              <Text style={[styles.balanceValue, payment.summary.advance_credit > 0 ? styles.creditValue : payment.summary.outstanding_amount === 0 ? styles.clearValue : null]}>
                {payment.summary.advance_credit > 0 ? formatMoney(payment.summary.advance_credit, 0) : payment.summary.outstanding_amount > 0 ? formatMoney(payment.summary.outstanding_amount, 0) : 'All clear'}
              </Text>
              <View style={styles.accountMetrics}>
                <View><Text style={styles.metricLabel}>TOTAL BILLED</Text><Text style={styles.metricValue}>{formatMoney(payment.summary.total_charged, 0)}</Text></View>
                <View style={styles.metricRight}><Text style={styles.metricLabel}>TOTAL RECEIVED</Text><Text style={styles.metricValue}>{formatMoney(payment.summary.total_paid, 0)}</Text></View>
              </View>
            </View>

            <View style={styles.formCard}>
              <View style={styles.formHeading}><View style={styles.stepBadge}><Text style={styles.stepText}>{configuration.preferences.currency_symbol}</Text></View><View><Text style={styles.formTitle}>New receipt</Text><Text style={styles.formSubtitle}>Payment date: {formatBusinessDate(payment.date)}</Text></View></View>

              <Text style={styles.fieldLabel}>AMOUNT RECEIVED *</Text>
              <View style={styles.amountWrap}><Text style={styles.currency}>{configuration.preferences.currency_symbol}</Text><TextInput style={styles.amountInput} value={payment.amount} onChangeText={payment.setAmount} placeholder="0" keyboardType="decimal-pad" autoFocus /></View>
              {payment.summary.outstanding_amount > 0 ? (
                <View style={styles.quickRow}>
                  <TouchableOpacity style={styles.quickChip} onPress={() => payment.setAmount(String(payment.summary.outstanding_amount))}><Text style={styles.quickText}>Full balance</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => payment.setAmount(String(Math.round(payment.summary.outstanding_amount / 2)))}><Text style={styles.quickText}>Half</Text></TouchableOpacity>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>PAYMENT METHOD *</Text>
              <View style={styles.methodRow}>{methods.map(option => <TouchableOpacity key={option.value} style={[styles.methodChip, payment.method === option.value && styles.methodChipOn]} onPress={() => payment.setMethod(option.value)}><Text style={[styles.methodText, payment.method === option.value && styles.methodTextOn]}>{option.label}</Text></TouchableOpacity>)}</View>

              <Text style={styles.fieldLabel}>NOTE</Text>
              <TextInput style={styles.input} value={payment.notes} onChangeText={payment.setNotes} placeholder="Optional internal note" />
              <Text style={styles.fieldLabel}>REFERENCE NUMBER (OPTIONAL)</Text>
              <TextInput style={styles.input} value={payment.reference} onChangeText={payment.setReference} placeholder="Receipt, voucher, or transaction reference" autoCapitalize="characters" />

              {numericAmount > 0 ? (
                <View style={styles.resultStrip}>
                  <View><Text style={styles.resultLabel}>{balanceAfter < 0 ? 'ADVANCE AFTER RECEIPT' : 'BALANCE AFTER RECEIPT'}</Text><Text style={styles.resultHint}>{balanceAfter < 0 ? 'Excess remains as customer credit' : balanceAfter === 0 ? 'This account will be fully settled' : 'Remaining amount to collect'}</Text></View>
                  <Text style={styles.resultValue}>{formatMoney(Math.abs(balanceAfter), 0)}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={[styles.submitButton, payment.submitting && styles.disabled]} disabled={payment.submitting} onPress={payment.record}>{payment.submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Record receipt</Text>}</TouchableOpacity>
            </View>

            <View style={styles.historySection}>
              <View style={styles.historyHeading}><Text style={styles.historyTitle}>Receipt history</Text><Text style={styles.historyCount}>{payment.payments.length}</Text></View>
              {payment.payments.length === 0 ? <Text style={styles.emptyHistory}>No payments recorded for this customer</Text> : payment.payments.slice(0, 20).map(row => (
                <View key={row.id} style={[styles.receiptRow, row.voided_at ? styles.voidedRow : null]}>
                  <View style={styles.receiptMain}>
                    <View style={[styles.methodBadge, row.voided_at ? styles.voidedBadge : null]}><Text style={[styles.methodBadgeText, row.voided_at ? styles.voidedBadgeText : null]}>{row.payment_method === 'bank_transfer' ? 'BANK' : row.payment_method.toUpperCase()}</Text></View>
                    <View style={styles.receiptCopy}><Text style={[styles.receiptAmount, row.voided_at ? styles.voidedText : null]}>{formatMoney(row.amount, 0)}</Text><Text style={styles.receiptMeta}>{formatBusinessDate(row.payment_date)}{row.reference_number ? ` · ${row.reference_number}` : ''}</Text>{row.voided_at ? <Text style={styles.voidReason}>Voided · {row.void_reason}</Text> : row.advance_amount && row.advance_amount > 0 ? <Text style={styles.advanceMeta}>{formatMoney(row.advance_amount, 0)} advance</Text> : null}</View>
                    {!row.voided_at ? <TouchableOpacity style={styles.moreButton} onPress={() => setVoidTarget(row)}><Text style={styles.moreText}>Void</Text></TouchableOpacity> : null}
                  </View>
                </View>
              ))}
            </View>

            <DailyBillsPanel bills={payment.dailyBills} customers={payment.customers} loading={payment.loadingBills} onSelectCustomer={payment.selectCustomer} onDelete={payment.deleteBill} />
          </>
        )}
      </ScrollView>

      <PaymentVoidModal payment={voidTarget} saving={payment.submitting} onClose={() => setVoidTarget(null)} onConfirm={async reason => { if (voidTarget && await payment.voidPayment(voidTarget.id, reason)) setVoidTarget(null); }} />
    </View>
  );
}
