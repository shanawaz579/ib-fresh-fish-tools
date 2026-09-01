import supabase from '../lib/supabase';
import type { Bill, CustomerAccountSummary, CustomerLedger, LedgerTransaction, Payment } from '../types';
import { toLocalDateString } from '../utils/date';

const emptyAccountSummary: CustomerAccountSummary = {
  total_charged: 0,
  total_paid: 0,
  account_balance: 0,
  outstanding_amount: 0,
  advance_credit: 0,
  unpaid_bills_count: 0,
  oldest_bill_date: null,
};

export async function getCustomerAccountSummary(customerId: number, asOfDate?: string): Promise<CustomerAccountSummary> {
  const { data, error } = await supabase.rpc('get_customer_account_summary', {
    p_customer_id: customerId,
    p_as_of_date: asOfDate ?? toLocalDateString(),
  });
  if (error) throw error;
  const summary = Array.isArray(data) ? data[0] : data;
  if (!summary) return emptyAccountSummary;
  return {
    total_charged: Number(summary.total_charged) || 0,
    total_paid: Number(summary.total_paid) || 0,
    account_balance: Number(summary.account_balance) || 0,
    outstanding_amount: Number(summary.outstanding_amount) || 0,
    advance_credit: Number(summary.advance_credit) || 0,
    unpaid_bills_count: Number(summary.unpaid_bills_count) || 0,
    oldest_bill_date: summary.oldest_bill_date ?? null,
  };
}

export async function getCustomerOutstanding(customerId: number): Promise<{
  total_outstanding: number;
  unpaid_bills_count: number;
  oldest_bill_date: string | null;
}> {
  try {
    const summary = await getCustomerAccountSummary(customerId);
    return {
      total_outstanding: summary.outstanding_amount,
      unpaid_bills_count: summary.unpaid_bills_count,
      oldest_bill_date: summary.oldest_bill_date,
    };
  } catch (err) {
    console.error('Error getting customer outstanding:', err);
    return {
      total_outstanding: 0,
      unpaid_bills_count: 0,
      oldest_bill_date: null,
    };
  }
}

// Get bill preview data (previous balance and payments for upcoming bill)

export async function getBillPreviewData(customerId: number, billDate: string): Promise<{
  previousBalance: number;
  payments: any[];
  balanceDue: number;
}> {
  try {
    // Get previous active bill
    const { data: previousBill } = await supabase
      .from('bills')
      .select('id, total, bill_date')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .single();

    const previousBalance = previousBill?.total || 0;
    const previousBillDate = previousBill?.bill_date || '1900-01-01';

    // Get payments since previous bill
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .gt('payment_date', previousBillDate)
      .lte('payment_date', billDate)
      .order('payment_date', { ascending: true });

    const payments = paymentsData || [];
    const totalPayments = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const balanceDue = previousBalance - totalPayments;

    return {
      previousBalance,
      payments,
      balanceDue,
    };
  } catch (err) {
    console.error('Error getting bill preview data:', err);
    return {
      previousBalance: 0,
      payments: [],
      balanceDue: 0,
    };
  }
}

// Get unpaid bills for a customer (only active bill in new system)

export async function getUnpaidBills(customerId: number): Promise<Bill[]> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'unpaid')
      .eq('is_active', true)
      .order('bill_date', { ascending: true });

    if (error) throw error;

    return (data || []).map((bill: any) => ({
      ...bill,
      items: [],
      other_charges: [],
    }));
  } catch (err) {
    console.error('Error getting unpaid bills:', err);
    return [];
  }
}

// Create payment (simplified - no allocations)

export async function createPayment(
  customerId: number,
  paymentDate: string,
  amount: number,
  paymentMethod: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other',
  referenceNumber?: string,
  notes?: string
): Promise<Payment | null> {
  const { data, error } = await supabase.rpc('record_customer_payment', {
    p_customer_id: customerId,
    p_payment_date: paymentDate,
    p_amount: amount,
    p_payment_method: paymentMethod,
    p_reference_number: referenceNumber || null,
    p_notes: notes || null,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as Payment | null;
}

export async function voidCustomerPayment(paymentId: number, reason: string): Promise<boolean> {
  const { error } = await supabase.rpc('void_customer_payment', {
    p_payment_id: paymentId,
    p_void_reason: reason,
  });
  if (error) throw error;
  return true;
}

// Get payments by customer

export async function getPaymentsByCustomer(customerId: number): Promise<Payment[]> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error getting payments:', err);
    return [];
  }
}

// Get payment allocations for a payment
// Note: Payment allocations removed in simplified billing system
// Payments are now independent and shown in bills they were made between

// Get customer ledger (all transactions)

export async function getCustomerLedger(customerId: number, startDate?: string, endDate?: string): Promise<CustomerLedger | null> {
  try {
    // Get customer info
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    if (custError) throw custError;

    // Get outstanding balance
    const outstanding = await getCustomerOutstanding(customerId);

    // Get all bills
    let billsQuery = supabase
      .from('bills')
      .select('id, bill_number, bill_date, subtotal, discount, status')
      .eq('customer_id', customerId);

    if (startDate) billsQuery = billsQuery.gte('bill_date', startDate);
    if (endDate) billsQuery = billsQuery.lte('bill_date', endDate);

    const { data: bills, error: billsError } = await billsQuery.order('bill_date', { ascending: true });
    if (billsError) throw billsError;

    // Get all payments
    let paymentsQuery = supabase
      .from('payments')
      .select('id, payment_date, amount, payment_method, reference_number')
      .eq('customer_id', customerId);

    if (startDate) paymentsQuery = paymentsQuery.gte('payment_date', startDate);
    if (endDate) paymentsQuery = paymentsQuery.lte('payment_date', endDate);

    const { data: payments, error: paymentsError } = await paymentsQuery.order('payment_date', { ascending: true });
    if (paymentsError) throw paymentsError;

    // Combine and sort transactions
    const transactions: LedgerTransaction[] = [];
    let runningBalance = 0;

    const allTransactions = [
      ...(bills || []).map(b => ({ ...b, type: 'bill' as const, date: b.bill_date })),
      ...(payments || []).map(p => ({ ...p, type: 'payment' as const, date: p.payment_date })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

    for (const txn of allTransactions) {
      if (txn.type === 'bill') {
        const currentCharges = Number(txn.subtotal) - Number(txn.discount || 0);
        runningBalance += currentCharges;
        transactions.push({
          id: txn.id,
          date: txn.date,
          type: 'bill',
          reference: txn.bill_number,
          debit: currentCharges,
          balance: runningBalance,
          status: txn.status,
        });
      } else {
        runningBalance -= Number(txn.amount);
        transactions.push({
          id: txn.id,
          date: txn.date,
          type: 'payment',
          reference: txn.reference_number || `Payment #${txn.id}`,
          credit: Number(txn.amount),
          balance: runningBalance,
        });
      }
    }

    return {
      customer_id: customerId,
      customer_name: customer.name,
      total_outstanding: outstanding.total_outstanding,
      unpaid_bills_count: outstanding.unpaid_bills_count,
      oldest_bill_date: outstanding.oldest_bill_date || undefined,
      transactions,
    };
  } catch (err) {
    console.error('Error getting customer ledger:', err);
    return null;
  }
}

// Auto-allocate payment to oldest bills first (FIFO)

export function autoAllocatePayment(
  paymentAmount: number,
  unpaidBills: Bill[]
): { bill_id: number; allocated_amount: number }[] {
  const allocations: { bill_id: number; allocated_amount: number }[] = [];
  let remainingAmount = paymentAmount;

  // Sort bills by date (oldest first) and filter out bills with no balance
  const sortedBills = [...unpaidBills]
    .filter(bill => Number(bill.total) > 0)
    .sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime());

  for (const bill of sortedBills) {
    if (remainingAmount <= 0) break;

    const billTotal = Number(bill.total);
    const amountToAllocate = Math.min(remainingAmount, billTotal);

    // Only add allocation if amount is greater than 0
    if (amountToAllocate > 0) {
      allocations.push({
        bill_id: bill.id,
        allocated_amount: amountToAllocate,
      });

      remainingAmount -= amountToAllocate;
    }
  }

  return allocations;
}
