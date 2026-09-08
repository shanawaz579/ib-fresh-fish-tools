import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createPayment, getCustomerAccountSummary } from '../../api/stock';
import { useBusinessConfig } from '../../context/BusinessConfigContext';
import type { Payment } from '../../types';
import styles from '../../styles/SalesScreen.styles';

type PaymentMethod = Payment['payment_method'];
type Props = {
  visible: boolean;
  customerId?: number;
  customerName?: string;
  date: string;
  onClose: () => void;
};

const methods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank' },
];

function messageFrom(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again.';
}

export default function QuickCustomerPaymentModal({ visible, customerId, customerName, date, onClose }: Props) {
  const { configuration, formatMoney } = useBusinessConfig();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recorded, setRecorded] = useState<number | null>(null);

  useEffect(() => {
    if (!visible || !customerId) return;
    setAmount(''); setMethod('cash'); setReference(''); setError(''); setRecorded(null); setLoading(true);
    getCustomerAccountSummary(customerId, date)
      .then(summary => setOutstanding(summary.outstanding_amount))
      .catch(err => setError(messageFrom(err)))
      .finally(() => setLoading(false));
  }, [customerId, date, visible]);

  const record = async () => {
    if (!customerId) return;
    const value = Number.parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return; }
    setSaving(true); setError('');
    try {
      const payment = await createPayment(customerId, date, value, method, reference.trim() || undefined);
      if (!payment) throw new Error('Payment was not returned by the database.');
      setRecorded(value);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.quickPaymentBackdrop}>
        <View style={styles.quickPaymentModal}>
          {recorded !== null ? (
            <View style={styles.paymentSuccess}>
              <View style={styles.paymentSuccessIcon}><Text style={styles.paymentSuccessIconText}>✓</Text></View>
              <Text style={styles.quickPaymentTitle}>Payment recorded</Text>
              <Text style={styles.paymentSuccessAmount}>{formatMoney(recorded, 0)}</Text>
              <Text style={styles.quickPaymentSubtitle}>{customerName}</Text>
              <TouchableOpacity style={styles.quickPaymentSubmit} onPress={onClose}><Text style={styles.quickPaymentSubmitText}>Done</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.quickPaymentHeader}>
                <View><Text style={styles.quickPaymentEyebrow}>RECORD PAYMENT</Text><Text style={styles.quickPaymentTitle}>{customerName}</Text></View>
                <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={styles.quickPaymentClose}>×</Text></TouchableOpacity>
              </View>
              {loading ? <ActivityIndicator color="#0F766E" style={styles.quickPaymentLoader} /> : (
                <>
                  <View style={styles.quickPaymentBalance}><Text style={styles.quickPaymentBalanceLabel}>ACCOUNT BALANCE</Text><Text style={styles.quickPaymentBalanceValue}>{formatMoney(outstanding, 0)}</Text></View>
                  <Text style={styles.quickPaymentLabel}>AMOUNT RECEIVED *</Text>
                  <View style={styles.quickPaymentAmountWrap}><Text style={styles.quickPaymentCurrency}>{configuration.preferences.currency_symbol}</Text><TextInput style={styles.quickPaymentAmount} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" autoFocus /></View>
                  {outstanding > 0 ? <TouchableOpacity style={styles.quickPaymentFull} onPress={() => setAmount(String(outstanding))}><Text style={styles.quickPaymentFullText}>Use full balance</Text></TouchableOpacity> : null}
                  <Text style={styles.quickPaymentLabel}>PAID USING</Text>
                  <View style={styles.quickPaymentMethods}>{methods.map(option => <TouchableOpacity key={option.value} style={[styles.quickPaymentMethod, method === option.value && styles.quickPaymentMethodOn]} onPress={() => setMethod(option.value)}><Text style={[styles.quickPaymentMethodText, method === option.value && styles.quickPaymentMethodTextOn]}>{option.label}</Text></TouchableOpacity>)}</View>
                  <Text style={styles.quickPaymentLabel}>REFERENCE (OPTIONAL)</Text>
                  <TextInput style={styles.quickPaymentReference} value={reference} onChangeText={setReference} placeholder="UPI, bank or receipt reference" autoCapitalize="characters" />
                  {error ? <Text style={styles.quickPaymentError}>{error}</Text> : null}
                  <TouchableOpacity style={[styles.quickPaymentSubmit, saving && styles.quickPaymentSubmitDisabled]} disabled={saving} onPress={record}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.quickPaymentSubmitText}>Record payment</Text>}</TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
