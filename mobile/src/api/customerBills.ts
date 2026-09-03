import supabase from '../lib/supabase';
import type { Bill, BillItem, BillOtherCharge, Payment } from '../types';
import { DEFAULT_CRATE_WEIGHT_KG } from '../domain/fish';

// Get last rate for a fish variety from bill_items

export async function getLastRateForVariety(varietyId: number): Promise<{ rate_per_crate: number; rate_per_kg: number } | null> {
  try {
    const { data, error } = await supabase
      .from('bill_items')
      .select('rate_per_crate, rate_per_kg')
      .eq('fish_variety_id', varietyId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        rate_per_crate: data[0].rate_per_crate || 0,
        rate_per_kg: data[0].rate_per_kg || 0,
      };
    }
    return null;
  } catch (err) {
    console.error('Error getting last rate:', err);
    return null;
  }
}

// Create a new bill

export async function createBill(
  customerId: number,
  billDate: string,
  items: Omit<BillItem, 'amount'>[],
  otherCharges: Omit<BillOtherCharge, 'id' | 'bill_id'>[] = [],
  discount: number = 0,
  notes?: string,
  paymentsToRecord: Array<{
    amount: number;
    payment_method: Payment['payment_method'];
    reference_number?: string;
    notes?: string;
  }> = [],
  markAsPaid: boolean = false,
  replaceBillId?: number,
  correctionReason?: string,
): Promise<Bill | null> {
  try {
    const rpcItems = items.map(item => ({
      ...item,
      crate_weight: item.crate_weight ?? DEFAULT_CRATE_WEIGHT_KG,
      sale_ids: item.sale_ids ?? [],
    }));
    const { data, error } = replaceBillId
      ? await supabase.rpc('revise_customer_bill', {
          p_bill_id: replaceBillId,
          p_reason: correctionReason?.trim() || '',
          p_customer_id: customerId,
          p_bill_date: billDate,
          p_items: rpcItems,
          p_other_charges: otherCharges,
          p_discount: discount,
          p_notes: notes || null,
          p_payments: paymentsToRecord,
          p_mark_as_paid: markAsPaid,
        })
      : await supabase.rpc('create_customer_bill', {
          p_customer_id: customerId,
          p_bill_date: billDate,
          p_items: rpcItems,
          p_other_charges: otherCharges,
          p_discount: discount,
          p_notes: notes || null,
          p_payments: paymentsToRecord,
          p_mark_as_paid: markAsPaid,
          p_replace_bill_id: null,
        });

    if (error) throw error;
    const createdBill = Array.isArray(data) ? data[0] : data;
    if (!createdBill?.id) throw new Error('Database did not return the created bill');

    return await getBillById(createdBill.id);
  } catch (err: any) {
    console.error('Error creating bill:', err?.message || err);
    return null;
  }
}

// Get bills by date

export async function getBillsByDate(date: string): Promise<Bill[]> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('bill_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((bill: any) => ({
      ...bill,
      items: [],
    }));
  } catch (err) {
    console.error('Error getting bills by date:', err);
    return [];
  }
}

// Get all bills by customer

export async function getBillsByCustomer(customerId: number): Promise<Bill[]> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        bill_items(*)
      `)
      .eq('customer_id', customerId)
      .order('bill_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((bill: any) => ({
      ...bill,
      items: bill.bill_items || [],
      other_charges: [],
    }));
  } catch (err) {
    console.error('Error getting bills by customer:', err);
    return [];
  }
}

// Get bill by ID with items, other charges, and payments

export async function getBillById(id: number): Promise<Bill | null> {
  try {
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .select('*')
      .eq('id', id)
      .single();

    if (billError) throw billError;

    const { data: itemsData, error: itemsError } = await supabase
      .from('bill_items')
      .select('*, bill_item_sales(sale_id)')
      .eq('bill_id', id);

    if (itemsError) throw itemsError;

    const { data: chargesData, error: chargesError} = await supabase
      .from('bill_other_charges')
      .select('*')
      .eq('bill_id', id);

    if (chargesError) throw chargesError;

    // Get payments that were included in this bill
    // First, find the previous bill date for this customer
    const { data: previousBillData } = await supabase
      .from('bills')
      .select('bill_date')
      .eq('customer_id', billData.customer_id)
      .lt('bill_date', billData.bill_date)
      .order('bill_date', { ascending: false })
      .limit(1)
      .single();

    const previousBillDate = previousBillData?.bill_date || '1900-01-01';

    // Fetch payments between previous bill date and this bill date (exclusive of previous, inclusive of current)
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', billData.customer_id)
      .gt('payment_date', previousBillDate)
      .lte('payment_date', billData.bill_date)
      .order('payment_date', { ascending: true });

    return {
      ...billData,
      items: (itemsData || []).map((item: any) => ({
        ...item,
        sale_ids: (item.bill_item_sales || []).map((link: { sale_id: number }) => link.sale_id),
      })),
      other_charges: chargesData || [],
      payments: paymentsData || [],
    };
  } catch (err) {
    console.error('Error getting bill:', err);
    return null;
  }
}

export async function releaseCustomerBillForCorrection(id: number, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('release_customer_bill_for_correction', {
    p_bill_id: id,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  if (!data) throw new Error('Bill was not found');
}
