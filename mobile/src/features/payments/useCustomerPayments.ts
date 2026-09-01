import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { createPayment, deleteBillStrict, getBillsByDate, getCustomerAccountSummary, getCustomers, getPaymentsByCustomer, voidCustomerPayment } from '../../api/stock';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { Bill, Customer, CustomerAccountSummary, Payment } from '../../types';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

export type PaymentMethod = Payment['payment_method'];

const emptySummary: CustomerAccountSummary = {
  total_charged: 0, total_paid: 0, account_balance: 0, outstanding_amount: 0,
  advance_credit: 0, unpaid_bills_count: 0, oldest_bill_date: null,
};

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Please check the details and try again.';
}

export function useCustomerPayments() {
  const { formatMoney } = useBusinessConfig();
  const businessDate = useBusinessDate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [summary, setSummary] = useState<CustomerAccountSummary>(emptySummary);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dailyBills, setDailyBills] = useState<Bill[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingBills, setLoadingBills] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId);

  useEffect(() => {
    getCustomers().then(setCustomers).catch(error => {
      console.error('Unable to load payment customers:', error);
      Alert.alert('Unable to load customers', 'Check the connection and try again.');
    }).finally(() => setLoading(false));
  }, []);

  const loadDailyBills = useCallback(async () => {
    setLoadingBills(true);
    try {
      setDailyBills(await getBillsByDate(businessDate.date));
    } catch (error) {
      console.error('Unable to load daily bills:', error);
      Alert.alert('Unable to load bills', 'Check the connection and try again.');
    } finally {
      setLoadingBills(false);
    }
  }, [businessDate.date]);

  useEffect(() => { void loadDailyBills(); }, [loadDailyBills]);

  const loadCustomer = useCallback(async (customerId: number, date = businessDate.date) => {
    setLoading(true);
    try {
      const [accountSummary, paymentRows] = await Promise.all([
        getCustomerAccountSummary(customerId, date),
        getPaymentsByCustomer(customerId),
      ]);
      setSummary(accountSummary);
      setPayments(paymentRows);
    } catch (error) {
      console.error('Unable to load customer payments:', error);
      Alert.alert('Unable to load account', 'Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [businessDate.date]);

  useEffect(() => {
    if (selectedCustomerId) void loadCustomer(selectedCustomerId);
  }, [businessDate.date, loadCustomer, selectedCustomerId]);

  const selectCustomer = (customerId: number) => {
    setSelectedCustomerId(customerId);
    setAmount(''); setReference(''); setNotes('');
  };

  const record = async (): Promise<boolean> => {
    if (!selectedCustomerId) return false;
    const numericAmount = Number.parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Enter payment amount', 'Amount must be greater than zero.');
      return false;
    }
    setSubmitting(true);
    try {
      const payment = await createPayment(selectedCustomerId, businessDate.date, numericAmount, method, reference.trim() || undefined, notes.trim() || undefined);
      if (!payment) throw new Error('No payment returned');
      const result = payment.advance_amount && payment.advance_amount > 0
        ? `${formatMoney(payment.applied_amount ?? 0, 0)} applied and ${formatMoney(payment.advance_amount, 0)} saved as advance.`
        : `Balance after payment: ${formatMoney(Math.max(Number(payment.balance_after) || 0, 0), 0)}.`;
      Alert.alert('Payment recorded', result);
      setAmount(''); setReference(''); setNotes(''); setMethod('cash');
      await loadCustomer(selectedCustomerId);
      await loadDailyBills();
      return true;
    } catch (error) {
      console.error('Unable to record customer payment:', error);
      Alert.alert('Unable to record payment', errorMessage(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const voidPayment = async (paymentId: number, reason: string): Promise<boolean> => {
    if (!selectedCustomerId) return false;
    setSubmitting(true);
    try {
      await voidCustomerPayment(paymentId, reason);
      await loadCustomer(selectedCustomerId);
      await loadDailyBills();
      Alert.alert('Payment voided', 'The receipt remains in history and the account balance was recalculated.');
      return true;
    } catch (error) {
      Alert.alert('Unable to void payment', errorMessage(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBill = async (billId: number): Promise<boolean> => {
    setSubmitting(true);
    try {
      await deleteBillStrict(billId);
      if (selectedCustomerId) await loadCustomer(selectedCustomerId);
      await loadDailyBills();
      Alert.alert('Bill deleted', 'Bill details were removed and its source sales are available for rebilling.');
      return true;
    } catch (error) {
      const message = errorMessage(error);
      Alert.alert(
        message.includes('Void active receipts') ? 'Payment must be voided first' : 'Unable to delete bill',
        message,
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    ...businessDate, customers, dailyBills, loadingBills, selectedCustomerId, selectedCustomer, selectCustomer,
    summary, payments, loading, submitting, amount, setAmount, method, setMethod,
    reference, setReference, notes, setNotes, record, voidPayment, deleteBill,
  };
}
