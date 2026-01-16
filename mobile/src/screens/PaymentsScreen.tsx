import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  getCustomers,
  getUnpaidBills,
  createPayment,
  getPaymentsByCustomer,
  getCustomerOutstanding,
  deletePayment,
  updatePayment,
} from '../api/stock';
import type { Customer, Bill, Payment } from '../types';

export default function PaymentsScreen() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [unpaidBills, setUnpaidBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // Customer outstanding
  const [customerOutstanding, setCustomerOutstanding] = useState({
    total_outstanding: 0,
    unpaid_bills_count: 0,
    oldest_bill_date: null as string | null,
  });

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerData(selectedCustomerId);
    }
  }, [selectedCustomerId, date]);

  const loadCustomers = async () => {
    const customersData = await getCustomers();
    setCustomers(customersData);
  };

  const loadCustomerData = async (customerId: number) => {
    setLoading(true);
    const [bills, paymentsData, outstanding] = await Promise.all([
      getUnpaidBills(customerId),
      getPaymentsByCustomer(customerId),
      getCustomerOutstanding(customerId),
    ]);
    setUnpaidBills(bills);
    setPayments(paymentsData);
    setCustomerOutstanding(outstanding);
    setLoading(false);
  };

  const handleCustomerSelect = async (customerId: number | null) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setUnpaidBills([]);
      setPayments([]);
      setCustomerOutstanding({
        total_outstanding: 0,
        unpaid_bills_count: 0,
        oldest_bill_date: null,
      });
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedCustomerId) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    setSubmitting(true);
    try {
      const payment = await createPayment(
        selectedCustomerId,
        date,
        amount,
        paymentMethod,
        referenceNumber || undefined,
        notes || undefined
      );

      if (payment) {
        Alert.alert('Success', 'Payment recorded successfully!');
        resetForm();
        if (selectedCustomerId) {
          await loadCustomerData(selectedCustomerId);
        }
      } else {
        Alert.alert('Error', 'Failed to record payment');
      }
    } catch (err: any) {
      console.error('Error creating payment:', err);
      Alert.alert('Error', `Failed to record payment: ${err?.message || JSON.stringify(err)}`);
    }
    setSubmitting(false);
  };

  const handleDeletePayment = async (paymentId: number, amount: number) => {
    Alert.alert(
      'Delete Payment',
      `Are you sure you want to delete this payment of ₹${amount.toLocaleString('en-IN')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePayment(paymentId);
            if (success) {
              Alert.alert('Success', 'Payment deleted successfully');
              if (selectedCustomerId) {
                await loadCustomerData(selectedCustomerId);
              }
            } else {
              Alert.alert('Error', 'Failed to delete payment');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setPaymentAmount('');
    setReferenceNumber('');
    setNotes('');
    setPaymentMethod('cash');
  };

  const goToPreviousDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
  };

  const paymentAmountNum = parseFloat(paymentAmount) || 0;
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Record Payment</Text>
      </View>

      {/* Date Picker */}
      <View style={styles.dateContainer}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>
          {new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Customer Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Customer</Text>
          <Picker
            selectedValue={selectedCustomerId}
            onValueChange={handleCustomerSelect}
            style={styles.picker}
          >
            <Picker.Item label="Choose a customer..." value={null} />
            {customers.map((customer) => (
              <Picker.Item key={customer.id} label={customer.name} value={customer.id} />
            ))}
          </Picker>
        </View>

        {/* Customer Outstanding Card */}
        {selectedCustomerId && (
          <View style={styles.outstandingCard}>
            <View style={styles.outstandingHeader}>
              <Text style={styles.customerName}>{selectedCustomer?.name}</Text>
            </View>
            <View style={styles.outstandingContent}>
              <View style={styles.outstandingRow}>
                <Text style={styles.outstandingLabel}>Total Outstanding:</Text>
                <Text style={styles.outstandingValue}>
                  ₹{customerOutstanding.total_outstanding.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>
                  {customerOutstanding.unpaid_bills_count} unpaid bill{customerOutstanding.unpaid_bills_count !== 1 ? 's' : ''}
                </Text>
                {customerOutstanding.oldest_bill_date && (
                  <Text style={styles.infoText}>
                    Oldest: {Math.floor((Date.now() - new Date(customerOutstanding.oldest_bill_date).getTime()) / (1000 * 60 * 60 * 24))} days
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Payment Form */}
        {selectedCustomerId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>

            {/* Payment Amount */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Amount *</Text>
              <View style={styles.amountInputWrapper}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                />
              </View>
            </View>

            {/* Payment Method */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Payment Method *</Text>
              <Picker
                selectedValue={paymentMethod}
                onValueChange={setPaymentMethod}
                style={styles.picker}
              >
                <Picker.Item label="💵 Cash" value="cash" />
                <Picker.Item label="🏦 Bank Transfer" value="bank_transfer" />
                <Picker.Item label="📱 UPI" value="upi" />
                <Picker.Item label="📝 Cheque" value="cheque" />
                <Picker.Item label="Other" value="other" />
              </Picker>
            </View>

            {/* Reference Number */}
            {paymentMethod !== 'cash' && (
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Reference Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Transaction ID / Cheque No."
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                />
              </View>
            )}

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Add any notes..."
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            {/* Payment Info */}
            {paymentAmountNum > 0 && (
              <View style={styles.paymentInfoSection}>
                <Text style={styles.paymentInfoTitle}>💡 How this payment works:</Text>
                <Text style={styles.paymentInfoText}>
                  • Payment will be saved for {new Date(date).toLocaleDateString('en-IN')}
                </Text>
                <Text style={styles.paymentInfoText}>
                  • It will appear in the next bill you create for this customer
                </Text>
                <Text style={styles.paymentInfoText}>
                  • Current bill (IB-0004) will not be modified
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleRecordPayment}
              disabled={submitting}
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>💰 Record Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Payments */}
        {selectedCustomerId && payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            {payments.slice(0, 5).map((payment) => (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentDateAmount}>
                    <Text style={styles.paymentDate}>
                      {new Date(payment.payment_date).toLocaleDateString('en-IN')}
                    </Text>
                    <Text style={styles.paymentAmount}>
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.paymentActions}>
                    <TouchableOpacity
                      onPress={() => handleDeletePayment(payment.id, payment.amount)}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.paymentDetails}>
                  <Text style={styles.paymentMethod}>
                    {payment.payment_method.replace('_', ' ').toUpperCase()}
                  </Text>
                  {payment.reference_number && (
                    <Text style={styles.paymentRef}>Ref: {payment.reference_number}</Text>
                  )}
                </View>
                {payment.notes && (
                  <Text style={styles.paymentNotes}>{payment.notes}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {selectedCustomerId && !loading && unpaidBills.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>✓ No unpaid bills</Text>
            <Text style={styles.emptySubtext}>
              You can still record an advance payment
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#10B981',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateButton: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  dateButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 12,
  },
  todayButton: {
    padding: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
    marginLeft: 8,
  },
  todayButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  picker: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  outstandingCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FDE68A',
    overflow: 'hidden',
  },
  outstandingHeader: {
    backgroundColor: '#F59E0B',
    padding: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  outstandingContent: {
    padding: 16,
  },
  outstandingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  outstandingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  outstandingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoText: {
    fontSize: 13,
    color: '#78350F',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  rupeeSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#92400E',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#92400E',
    padding: 0,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  paymentInfoSection: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  paymentInfoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 12,
  },
  paymentInfoText: {
    fontSize: 13,
    color: '#1E40AF',
    marginBottom: 6,
    lineHeight: 20,
  },
  allocationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 12,
  },
  allocationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  allocationLeft: {
    flex: 1,
  },
  billNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  billDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  allocationRight: {
    alignItems: 'flex-end',
  },
  billDue: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 4,
  },
  allocatedAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  paidBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  excessWarning: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  excessText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  excessSubtext: {
    fontSize: 12,
    color: '#78350F',
  },
  advanceNotice: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  advanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  advanceSubtext: {
    fontSize: 12,
    color: '#3B82F6',
  },
  submitButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  paymentCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  paymentDateAmount: {
    flex: 1,
  },
  paymentDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 4,
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    fontSize: 18,
  },
  paymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  paymentRef: {
    fontSize: 12,
    color: '#6B7280',
  },
  paymentNotes: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: '#F0FDF4',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
});
