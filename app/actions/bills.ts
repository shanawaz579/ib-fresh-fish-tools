'use server';

import supabase from '@/lib/supabaseClient';

export type BillItem = {
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  rate_per_crate: number;
  rate_per_kg: number;
  amount: number;
};

export type Bill = {
  id: number;
  bill_number: string;
  customer_id: number;
  customer_name?: string;
  bill_date: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_status: 'pending' | 'partial' | 'paid';
  notes?: string;
  created_at?: string;
};

// Get next bill number
export async function getNextBillNumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('bill_number')
      .order('id', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastNumber = parseInt(data[0].bill_number.replace('IB-', '')) || 0;
      return `IB-${String(lastNumber + 1).padStart(4, '0')}`;
    }
    return 'IB-0001';
  } catch (err) {
    console.error('Error getting next bill number:', err);
    return `IB-${Date.now()}`;
  }
}

// Get last rate for a fish variety
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

// Get last rates for multiple varieties at once
export async function getLastRatesForVarieties(varietyIds: number[]): Promise<{ [varietyId: number]: { rate_per_crate: number; rate_per_kg: number } }> {
  try {
    const rates: { [varietyId: number]: { rate_per_crate: number; rate_per_kg: number } } = {};

    // Get all bill items for these varieties, ordered by created_at desc
    const { data, error } = await supabase
      .from('bill_items')
      .select('fish_variety_id, rate_per_crate, rate_per_kg, created_at')
      .in('fish_variety_id', varietyIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get the most recent rate for each variety
    if (data) {
      for (const item of data) {
        if (!rates[item.fish_variety_id]) {
          rates[item.fish_variety_id] = {
            rate_per_crate: item.rate_per_crate || 0,
            rate_per_kg: item.rate_per_kg || 0,
          };
        }
      }
    }

    return rates;
  } catch (err) {
    console.error('Error getting last rates:', err);
    return {};
  }
}

// Create a new bill
export async function createBill(
  customerId: number,
  billDate: string,
  items: Omit<BillItem, 'amount'>[],
  discount: number = 0,
  notes?: string,
  previousBalance: number = 0,
  amountReceived: number = 0
): Promise<Bill | null> {
  try {
    const billNumber = await getNextBillNumber();

    // Calculate amounts
    const itemsWithAmount = items.map(item => ({
      ...item,
      amount: (item.quantity_crates * item.rate_per_crate) + (item.quantity_kg * item.rate_per_kg),
    }));

    const subtotal = itemsWithAmount.reduce((sum, item) => sum + item.amount, 0);
    const total = subtotal - discount;
    const grandTotal = total + previousBalance;
    const balanceDue = grandTotal - amountReceived;

    // Determine payment status
    let paymentStatus = 'pending';
    if (amountReceived >= grandTotal) {
      paymentStatus = 'paid';
    } else if (amountReceived > 0) {
      paymentStatus = 'partial';
    }

    // Insert bill
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .insert({
        bill_number: billNumber,
        customer_id: customerId,
        bill_date: billDate,
        subtotal,
        discount,
        total,
        previous_balance: previousBalance,
        amount_received: amountReceived,
        balance_due: balanceDue,
        payment_status: paymentStatus,
        notes: notes || null,
      })
      .select('*, customers(name)')
      .single();

    if (billError) {
      console.error('Bill insert error:', billError);
      throw billError;
    }

    // Insert bill items
    const billItems = itemsWithAmount.map(item => ({
      bill_id: billData.id,
      fish_variety_id: item.fish_variety_id,
      fish_variety_name: item.fish_variety_name,
      quantity_crates: item.quantity_crates,
      quantity_kg: item.quantity_kg,
      rate_per_crate: item.rate_per_crate,
      rate_per_kg: item.rate_per_kg,
      amount: item.amount,
    }));

    const { error: itemsError } = await supabase
      .from('bill_items')
      .insert(billItems);

    if (itemsError) {
      console.error('Bill items insert error:', itemsError);
      throw itemsError;
    }

    return {
      ...billData,
      customer_name: billData.customers?.name,
      items: itemsWithAmount,
    };
  } catch (err: any) {
    console.error('Error creating bill:', err?.message || err);
    return null;
  }
}

// Get bill by ID
export async function getBillById(id: number): Promise<Bill | null> {
  try {
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .select('*, customers(name)')
      .eq('id', id)
      .single();

    if (billError) throw billError;

    const { data: itemsData, error: itemsError } = await supabase
      .from('bill_items')
      .select('*')
      .eq('bill_id', id);

    if (itemsError) throw itemsError;

    return {
      ...billData,
      customer_name: billData.customers?.name,
      items: itemsData || [],
    };
  } catch (err) {
    console.error('Error getting bill:', err);
    return null;
  }
}

// Get bills by date
export async function getBillsByDate(date: string): Promise<Bill[]> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*, customers(name)')
      .eq('bill_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((bill: any) => ({
      ...bill,
      customer_name: bill.customers?.name,
      items: [],
    }));
  } catch (err) {
    console.error('Error getting bills by date:', err);
    return [];
  }
}

// Get bills by customer
export async function getBillsByCustomer(customerId: number): Promise<Bill[]> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*, customers(name)')
      .eq('customer_id', customerId)
      .order('bill_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((bill: any) => ({
      ...bill,
      customer_name: bill.customers?.name,
      items: [],
    }));
  } catch (err) {
    console.error('Error getting bills by customer:', err);
    return [];
  }
}

// Update bill payment status
export async function updateBillPaymentStatus(id: number, status: 'pending' | 'partial' | 'paid'): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bills')
      .update({ payment_status: status })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating bill status:', err);
    return false;
  }
}

// Update existing bill
export async function updateBill(
  billId: number,
  items: Omit<BillItem, 'amount'>[],
  discount: number = 0,
  notes?: string,
  previousBalance: number = 0,
  amountReceived: number = 0
): Promise<Bill | null> {
  try {
    // Calculate amounts
    const itemsWithAmount = items.map(item => ({
      ...item,
      amount: (item.quantity_crates * item.rate_per_crate) + (item.quantity_kg * item.rate_per_kg),
    }));

    const subtotal = itemsWithAmount.reduce((sum, item) => sum + item.amount, 0);
    const total = subtotal - discount;
    const grandTotal = total + previousBalance;
    const balanceDue = grandTotal - amountReceived;

    // Determine payment status
    let paymentStatus = 'pending';
    if (amountReceived >= grandTotal) {
      paymentStatus = 'paid';
    } else if (amountReceived > 0) {
      paymentStatus = 'partial';
    }

    // Update bill
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .update({
        subtotal,
        discount,
        total,
        previous_balance: previousBalance,
        amount_received: amountReceived,
        balance_due: balanceDue,
        payment_status: paymentStatus,
        notes: notes || null,
      })
      .eq('id', billId)
      .select('*, customers(name)')
      .single();

    if (billError) {
      console.error('Bill update error:', billError);
      throw billError;
    }

    // Delete old bill items and insert new ones
    await supabase.from('bill_items').delete().eq('bill_id', billId);

    const billItems = itemsWithAmount.map(item => ({
      bill_id: billId,
      fish_variety_id: item.fish_variety_id,
      fish_variety_name: item.fish_variety_name,
      quantity_crates: item.quantity_crates,
      quantity_kg: item.quantity_kg,
      rate_per_crate: item.rate_per_crate,
      rate_per_kg: item.rate_per_kg,
      amount: item.amount,
    }));

    const { error: itemsError } = await supabase
      .from('bill_items')
      .insert(billItems);

    if (itemsError) {
      console.error('Bill items insert error:', itemsError);
      throw itemsError;
    }

    return {
      ...billData,
      customer_name: billData.customers?.name,
      items: itemsWithAmount,
    };
  } catch (err: any) {
    console.error('Error updating bill:', err?.message || err);
    return null;
  }
}

// Delete bill
export async function deleteBill(id: number): Promise<boolean> {
  try {
    // Delete bill items first (cascade should handle this, but being explicit)
    await supabase.from('bill_items').delete().eq('bill_id', id);

    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting bill:', err);
    return false;
  }
}

// Check if bill exists for customer on a specific date
export async function getBillForCustomerOnDate(customerId: number, date: string): Promise<Bill | null> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*, customers(name)')
      .eq('customer_id', customerId)
      .eq('bill_date', date)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      // Get bill items
      const { data: itemsData } = await supabase
        .from('bill_items')
        .select('*')
        .eq('bill_id', data[0].id);

      return {
        ...data[0],
        customer_name: data[0].customers?.name,
        items: itemsData || [],
      };
    }
    return null;
  } catch (err) {
    console.error('Error checking bill for customer:', err);
    return null;
  }
}

// Get customer's pending balance (total of all unpaid bills)
export async function getCustomerPendingBalance(customerId: number): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('total, amount_received')
      .eq('customer_id', customerId)
      .in('payment_status', ['pending', 'partial']);

    if (error) throw error;

    // Calculate total pending: sum of (total - amount_received) for all unpaid bills
    const pending = (data || []).reduce((sum, bill) => {
      const billBalance = (bill.total || 0) - (bill.amount_received || 0);
      return sum + billBalance;
    }, 0);

    return pending;
  } catch (err) {
    console.error('Error getting customer balance:', err);
    return 0;
  }
}
