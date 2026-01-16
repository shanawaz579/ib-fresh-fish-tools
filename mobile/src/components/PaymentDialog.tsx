import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getUnpaidBills, createPayment, autoAllocatePayment } from '../api/stock';
import type { Bill } from '../types';

interface PaymentDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: number;
  customerName: string;
  initialAmount?: number;
  newBillId?: number | null; // If paying a newly created bill
}

export default function PaymentDialog({
  visible,
  onClose,
  onSuccess,
  customerId,
  customerName,
  initialAmount = 0,
  newBillId = null,
}: PaymentDialogProps) {
  const [paymentAmount, setPaymentAmount] = useState(initialAmount.toString());
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [unpaidBills, setUnpaidBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUnpaidBills();
      setPaymentAmount(initialAmount.toString());
    }
  }, [visible, customerId, initialAmount]);

  const loadUnpaidBills = async () => {
    setLoading(true);
    const bills = await getUnpaidBills(customerId);
    setUnpaidBills(bills);
    setLoading(false);
  };

  const getAllocations = () => {
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) return [];

    // If paying a new bill, prioritize it
    let billsToAllocate = [...unpaidBills];
    if (newBillId) {
      const newBill = billsToAllocate.find(b => b.id === newBillId);
      if (newBill) {
        billsToAllocate = [newBill, ...billsToAllocate.filter(b => b.id !== newBillId)];
      }
    }

    return autoAllocatePayment(amount, billsToAllocate);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    const allocations = getAllocations();
    if (allocations.length === 0) {
      Alert.alert('Error', 'No bills to allocate payment to');
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const payment = await createPayment(
        customerId,
        today,
        amount,
        paymentMethod,
        referenceNumber || undefined,
        notes || undefined
      );

      if (payment) {
        Alert.alert('Success', 'Payment recorded successfully!');
        onSuccess();
        handleClose();
      } else {
        Alert.alert('Error', 'Failed to record payment');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to record payment');
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setPaymentAmount('0');
    setPaymentMethod('cash');
    setReferenceNumber('');
    setNotes('');
    onClose();
  };

  const allocations = getAllocations();
  const totalOutstanding = unpaidBills.reduce((sum, bill) => sum + bill.total, 0);
  const paymentAmountNum = parseFloat(paymentAmount) || 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Record Payment</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Customer Info */}
          <View style={styles.customerCard}>
            <Text style={styles.customerName}>{customerName}</Text>
            <Text style={styles.outstandingText}>
              Total Outstanding: ₹{totalOutstanding.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.billsCountText}>
              {unpaidBills.length} unpaid bill{unpaidBills.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Payment Amount */}
          <View style={styles.section}>
            <Text style={styles.label}>Payment Amount *</Text>
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
          <View style={styles.section}>
            <Text style={styles.label}>Payment Method *</Text>
            <Picker
              selectedValue={paymentMethod}
              onValueChange={setPaymentMethod}
              style={styles.picker}
            >
              <Picker.Item label="Cash" value="cash" />
              <Picker.Item label="Bank Transfer" value="bank_transfer" />
              <Picker.Item label="UPI" value="upi" />
              <Picker.Item label="Cheque" value="cheque" />
              <Picker.Item label="Other" value="other" />
            </Picker>
          </View>

          {/* Reference Number */}
          {paymentMethod !== 'cash' && (
            <View style={styles.section}>
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
          <View style={styles.section}>
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

          {/* Allocation Preview */}
          {paymentAmountNum > 0 && allocations.length > 0 && (
            <View style={styles.allocationSection}>
              <Text style={styles.sectionTitle}>Payment Allocation (Oldest First)</Text>
              {allocations.map((alloc, index) => {
                const bill = unpaidBills.find(b => b.id === alloc.bill_id);
                if (!bill) return null;
                return (
                  <View key={index} style={styles.allocationItem}>
                    <View style={styles.allocationLeft}>
                      <Text style={styles.billNumber}>{bill.bill_number}</Text>
                      <Text style={styles.billDate}>
                        {new Date(bill.bill_date).toLocaleDateString('en-IN')}
                      </Text>
                      <Text style={styles.billDue}>
                        Due: ₹{bill.total.toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={styles.allocationRight}>
                      <Text style={styles.allocatedAmount}>
                        -₹{alloc.allocated_amount.toLocaleString('en-IN')}
                      </Text>
                      {alloc.allocated_amount >= bill.total && (
                        <Text style={styles.paidBadge}>Fully Paid</Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {paymentAmountNum > totalOutstanding && (
                <View style={styles.excessWarning}>
                  <Text style={styles.excessText}>
                    ⚠️ Excess amount: ₹{(paymentAmountNum - totalOutstanding).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.excessSubtext}>
                    Only ₹{totalOutstanding.toLocaleString('en-IN')} will be allocated to bills
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || loading}
            style={[styles.submitButton, (submitting || loading) && styles.buttonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Record Payment</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#10B981',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  outstandingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  billsCountText: {
    fontSize: 13,
    color: '#6B7280',
  },
  section: {
    marginBottom: 20,
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
  picker: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  input: {
    backgroundColor: '#fff',
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
  allocationSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  allocationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    marginBottom: 2,
  },
  billDue: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  allocationRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  allocatedAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  paidBadge: {
    fontSize: 10,
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
  submitButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
