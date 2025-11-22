'use server';

import supabase from '@/lib/supabaseClient';

export type Payment = {
  id: number;
  customer_id?: number;
  customer_name?: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  payment_date: string;
  created_at?: string;
};

// Note: PAYMENT_METHODS is defined in the client component since server actions can only export functions

// Fetch payments for a specific date
export async function getPaymentsByDate(date: string): Promise<Payment[]> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*, customers(name)')
      .eq('payment_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      customer_name: item.customers?.name || item.received_from,
    }));
  } catch (err) {
    console.error('Error fetching payments:', err);
    return [];
  }
}

// Fetch payments for a date range
export async function getPaymentsByDateRange(
  startDate: string,
  endDate: string
): Promise<Payment[]> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*, customers(name)')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .order('payment_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      customer_name: item.customers?.name || item.received_from,
    }));
  } catch (err) {
    console.error('Error fetching payments by date range:', err);
    return [];
  }
}

// Add a new payment
export async function addPayment(
  amount: number,
  paymentDate: string,
  paymentMethod: string,
  customerId?: number,
  receivedFrom?: string,
  referenceNumber?: string,
  notes?: string
): Promise<Payment | null> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        customer_id: customerId || null,
        received_from: receivedFrom || null,
        amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        notes: notes || null,
        payment_date: paymentDate,
      })
      .select('*, customers(name)')
      .single();

    if (error) throw error;

    return {
      ...data,
      customer_name: data.customers?.name || data.received_from,
    };
  } catch (err) {
    console.error('Error adding payment:', err);
    return null;
  }
}

// Update a payment
export async function updatePayment(
  id: number,
  amount: number,
  paymentMethod: string,
  customerId?: number,
  receivedFrom?: string,
  referenceNumber?: string,
  notes?: string
): Promise<Payment | null> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .update({
        customer_id: customerId || null,
        received_from: receivedFrom || null,
        amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        notes: notes || null,
      })
      .eq('id', id)
      .select('*, customers(name)')
      .single();

    if (error) throw error;

    return {
      ...data,
      customer_name: data.customers?.name || data.received_from,
    };
  } catch (err) {
    console.error('Error updating payment:', err);
    return null;
  }
}

// Delete a payment
export async function deletePayment(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting payment:', err);
    return false;
  }
}

// Get payment summary by date
export async function getPaymentSummaryByDate(date: string): Promise<{
  total: number;
  byMethod: { method: string; total: number; count: number }[];
  count: number;
}> {
  try {
    const payments = await getPaymentsByDate(date);

    const byMethod: { [key: string]: { method: string; total: number; count: number } } = {};
    let total = 0;

    payments.forEach((payment) => {
      total += payment.amount;
      const method = payment.payment_method || 'Cash';
      if (!byMethod[method]) {
        byMethod[method] = { method, total: 0, count: 0 };
      }
      byMethod[method].total += payment.amount;
      byMethod[method].count += 1;
    });

    return {
      total,
      byMethod: Object.values(byMethod).sort((a, b) => b.total - a.total),
      count: payments.length,
    };
  } catch (err) {
    console.error('Error getting payment summary:', err);
    return { total: 0, byMethod: [], count: 0 };
  }
}

// Get monthly payment summary
export async function getMonthlyPaymentSummary(year: number, month: number): Promise<{
  total: number;
  byMethod: { method: string; total: number; count: number }[];
  byDay: { date: string; total: number }[];
}> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const payments = await getPaymentsByDateRange(startDate, endDate);

    const byMethod: { [key: string]: { method: string; total: number; count: number } } = {};
    const byDay: { [key: string]: number } = {};
    let total = 0;

    payments.forEach((payment) => {
      total += payment.amount;

      // By method
      const method = payment.payment_method || 'Cash';
      if (!byMethod[method]) {
        byMethod[method] = { method, total: 0, count: 0 };
      }
      byMethod[method].total += payment.amount;
      byMethod[method].count += 1;

      // By day
      if (!byDay[payment.payment_date]) {
        byDay[payment.payment_date] = 0;
      }
      byDay[payment.payment_date] += payment.amount;
    });

    return {
      total,
      byMethod: Object.values(byMethod).sort((a, b) => b.total - a.total),
      byDay: Object.entries(byDay)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch (err) {
    console.error('Error getting monthly payment summary:', err);
    return { total: 0, byMethod: [], byDay: [] };
  }
}
