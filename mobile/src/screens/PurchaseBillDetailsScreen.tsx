import styles from '../styles/PurchaseBillDetailsScreen.styles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { addDays, formatBusinessDate, parseLocalDate, toLocalDateString } from '../utils/date';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getPurchaseBillDetails, createPurchaseBillPayment, voidPurchaseBillPayment } from '../api/stock';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { PurchaseBillDetails } from '../domain/purchaseBillDetails';
import { generatePurchaseBillHtml } from '../features/purchaseBilling/purchaseBillDocument';
import DateNavigator from '../components/DateNavigator';
import { useBusinessConfig } from '../context/BusinessConfigContext';

type PurchaseBillDetailsRouteProp = RouteProp<RootStackParamList, 'PurchaseBillDetails'>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message);
    return message.replace(/^.*?:\s*/, '') || fallback;
  }
  return fallback;
}

export default function PurchaseBillDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<PurchaseBillDetailsRouteProp>();
  const { billId } = route.params;
  const { configuration, formatMoney } = useBusinessConfig();
  const currencySymbol = configuration.preferences.currency_symbol;

  const [billDetails, setBillDetails] = useState<PurchaseBillDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(toLocalDateString());
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentToVoid, setPaymentToVoid] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidingPayment, setVoidingPayment] = useState(false);

  useEffect(() => {
    loadBillDetails();
  }, []);

  const loadBillDetails = async () => {
    setLoading(true);
    try {
      const data = await getPurchaseBillDetails(billId);
      setBillDetails(data);
    } catch (error) {
      console.error('Error loading bill details:', error);
      Alert.alert('Error', 'Failed to load bill details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!billDetails) return;

    try {
      const html = generatePurchaseBillHtml(billDetails, configuration);

      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Purchase Bill - ${billDetails.bill_number}`,
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Success', 'Bill has been generated and saved');
      }
    } catch (error) {
      console.error('Error printing bill:', error);
      Alert.alert('Error', 'Failed to generate printable bill');
    }
  };

  const handleOpenPaymentModal = () => {
    if (!billDetails) return;
    setPaymentAmount(billDetails.balance_due.toString());
    setPaymentDate(toLocalDateString());
    setPaymentMode('cash');
    setPaymentReference('');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleAddPayment = async () => {
    if (!billDetails) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amount > billDetails.balance_due) {
      Alert.alert('Error', `Payment amount cannot exceed balance due (${formatMoney(billDetails.balance_due, 0)})`);
      return;
    }

    try {
      const selectedDate = parseLocalDate(paymentDate);
      if (selectedDate < parseLocalDate(billDetails.bill_date)) {
        Alert.alert('Error', 'Payment date cannot be before the bill date');
        return;
      }
      if (selectedDate > parseLocalDate(toLocalDateString())) {
        Alert.alert('Error', 'Payment date cannot be in the future');
        return;
      }
    } catch {
      Alert.alert('Error', 'Please select a valid payment date');
      return;
    }

    setSubmittingPayment(true);
    try {
      await createPurchaseBillPayment(
        billDetails.id,
        paymentDate,
        amount,
        paymentMode,
        paymentReference,
        paymentNotes
      );

      Alert.alert('Success', 'Payment recorded successfully');
      setShowPaymentModal(false);
      await loadBillDetails(); // Reload to get updated data
    } catch (error) {
      console.error('Error adding payment:', error);
      Alert.alert('Unable to record payment', getErrorMessage(error, 'Please try again'));
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleOpenVoidModal = (paymentId: number) => {
    setPaymentToVoid(paymentId);
    setVoidReason('');
  };

  const handleVoidPayment = async () => {
    if (!paymentToVoid || !voidReason.trim()) {
      Alert.alert('Reason required', 'Enter why this payment is being voided');
      return;
    }

    setVoidingPayment(true);
    try {
      await voidPurchaseBillPayment(paymentToVoid, voidReason);
      setPaymentToVoid(null);
      setVoidReason('');
      Alert.alert('Payment voided', 'The payment remains visible in the audit history');
      await loadBillDetails();
    } catch (error) {
      console.error('Error voiding payment:', error);
      Alert.alert('Unable to void payment', getErrorMessage(error, 'Please try again'));
    } finally {
      setVoidingPayment(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading bill details...</Text>
      </View>
    );
  }

  if (!billDetails) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Bill not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill Details</Text>
        <TouchableOpacity onPress={handlePrint} style={styles.printButton}>
          <Text style={styles.printButtonText}>Print</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Bill Header */}
        <View style={styles.billHeader}>
          <View style={styles.billHeaderRow}>
            <Text style={styles.billNumber}>{billDetails.bill_number}</Text>
            <View style={[
              styles.statusBadge,
              billDetails.payment_status === 'paid' && styles.statusPaid,
              billDetails.payment_status === 'pending' && styles.statusPending,
              billDetails.payment_status === 'partial' && styles.statusPartial,
            ]}>
              <Text style={[
                styles.statusText,
                billDetails.payment_status === 'paid' && styles.statusTextPaid,
                billDetails.payment_status === 'pending' && styles.statusTextPending,
                billDetails.payment_status === 'partial' && styles.statusTextPartial,
              ]}>
                {billDetails.payment_status === 'paid' && 'Paid'}
                {billDetails.payment_status === 'pending' && 'Pending'}
                {billDetails.payment_status === 'partial' && 'Partial'}
              </Text>
            </View>
          </View>
          <Text style={styles.farmerName}>{billDetails.supplier_name}</Text>
          {(billDetails.location || billDetails.secondary_name) && (
            <Text style={styles.billSubtitle}>
              {billDetails.location && billDetails.location}
              {billDetails.location && billDetails.secondary_name && ' • '}
              {billDetails.secondary_name && billDetails.secondary_name}
            </Text>
          )}
          <Text style={styles.billDate}>Date: {formatBusinessDate(billDetails.bill_date)}</Text>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {billDetails.items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.fish_variety_name}</Text>
                <Text style={styles.itemAmount}>
                  {formatMoney(item.amount, 0)}
                </Text>
              </View>
              <View style={styles.itemMainInfo}>
                <Text style={styles.itemMainText}>
                  {item.billable_weight} kg × {currencySymbol}{item.rate_per_kg}/kg
                </Text>
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemDetailText}>
                  {item.quantity_crates} cr · {item.actual_weight} actual kg
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bill Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                {formatMoney(billDetails.subtotal, 0)}
              </Text>
            </View>
            {billDetails.commission_amount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Commission ({currencySymbol}{billDetails.commission_per_kg.toFixed(2)}/kg)
                </Text>
                <Text style={styles.summaryValueAdd}>
                  +{formatMoney(billDetails.commission_amount, 2)}
                </Text>
              </View>
            ) : null}
            {billDetails.other_deductions.map((deduction, index) => {
              const isAddition = deduction.type === 'other_charges_addition';
              const isDeduction = deduction.type === 'other_charges_deduction';

              let displayName = '';
              if (deduction.type === 'other_charges_addition') {
                displayName = 'Other charges (+)';
              } else if (deduction.type === 'other_charges_deduction') {
                displayName = 'Other charges (-)';
              } else {
                displayName = deduction.type.charAt(0).toUpperCase() + deduction.type.slice(1).replace(/_/g, ' ');
              }

              return (
                <View key={index} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {displayName}
                  </Text>
                  <Text style={isAddition ? styles.summaryValueAdd : styles.summaryValueDeduction}>
                    {isAddition ? '+' : '-'}{formatMoney(deduction.amount, 0)}
                  </Text>
                </View>
              );
            })}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Bill Amount</Text>
              <Text style={styles.totalValue}>
                {formatMoney(billDetails.total, 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.paymentSummaryCard}>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryLabel}>Amount Paid</Text>
              <Text style={styles.paymentSummaryPaid}>
                {formatMoney(billDetails.amount_paid, 0)}
              </Text>
            </View>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryLabel}>Balance Due</Text>
              <Text style={styles.paymentSummaryDue}>
                {formatMoney(billDetails.balance_due, 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payments Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payments</Text>
            {billDetails.balance_due > 0 && (
              <TouchableOpacity
                style={styles.addPaymentButton}
                onPress={handleOpenPaymentModal}
              >
                <Text style={styles.addPaymentText}>+ Add Payment</Text>
              </TouchableOpacity>
            )}
          </View>
          {billDetails.payments.length === 0 ? (
            <View style={styles.noPaymentsContainer}>
              <Text style={styles.noPaymentsText}>No payments recorded yet</Text>
            </View>
          ) : (
            billDetails.payments.map((payment) => (
              <View key={payment.id} style={[styles.paymentCard, payment.voided_at ? styles.paymentCardVoided : null]}>
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentLeft}>
                    <Text style={[styles.paymentAmount, payment.voided_at ? styles.paymentTextVoided : null]}>
                      {formatMoney(payment.amount, 0)}
                    </Text>
                    <Text style={styles.paymentMode}>
                      {payment.payment_mode.toUpperCase()}
                    </Text>
                    {payment.reference_number ? (
                      <Text style={styles.paymentReference}>Ref: {payment.reference_number}</Text>
                    ) : null}
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentDate}>
                      {formatBusinessDate(payment.payment_date)}
                    </Text>
                    {payment.voided_at ? (
                      <Text style={styles.voidedBadge}>VOIDED</Text>
                    ) : (
                      <TouchableOpacity
                        style={styles.deletePaymentButton}
                        onPress={() => handleOpenVoidModal(payment.id)}
                      >
                        <Text style={styles.deletePaymentText}>Void</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {payment.notes && (
                  <Text style={styles.paymentNotes}>{payment.notes}</Text>
                )}
                {payment.void_reason ? (
                  <Text style={styles.voidReason}>Void reason: {payment.void_reason}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Notes Section */}
        {billDetails.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{billDetails.notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount ({currencySymbol})</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter amount"
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Date</Text>
                <DateNavigator
                  date={paymentDate}
                  onPrevious={() => setPaymentDate((date) => addDays(date, -1))}
                  onNext={() => setPaymentDate((date) => addDays(date, 1))}
                  onToday={() => setPaymentDate(toLocalDateString())}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Mode</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={paymentMode}
                    onValueChange={(value) => setPaymentMode(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Cash" value="cash" />
                    <Picker.Item label="Bank Transfer" value="bank_transfer" />
                    <Picker.Item label="UPI" value="upi" />
                    <Picker.Item label="Cheque" value="cheque" />
                    <Picker.Item label="Other" value="other" />
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Add notes (e.g., Transaction ID, Cheque No, etc.)..."
                  multiline
                  numberOfLines={4}
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reference number (Optional)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Receipt, voucher, or transaction reference"
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  autoCapitalize="characters"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submittingPayment && styles.submitButtonDisabled]}
                onPress={handleAddPayment}
                disabled={submittingPayment}
              >
                {submittingPayment ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Record Payment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={paymentToVoid !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPaymentToVoid(null)}
      >
        <View style={styles.centeredModalOverlay}>
          <View style={styles.voidModalContent}>
            <Text style={styles.modalTitle}>Void payment?</Text>
            <Text style={styles.voidModalHelp}>
              This keeps the payment in the audit history and restores the bill balance.
            </Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              placeholder="Reason for voiding (required)"
              multiline
              value={voidReason}
              onChangeText={setVoidReason}
            />
            <View style={styles.voidModalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setPaymentToVoid(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voidButton, voidingPayment && styles.submitButtonDisabled]}
                onPress={handleVoidPayment}
                disabled={voidingPayment}
              >
                {voidingPayment ? <ActivityIndicator color="#FFF" /> : <Text style={styles.voidButtonText}>Void payment</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
