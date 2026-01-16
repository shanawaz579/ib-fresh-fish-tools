'use server';

import supabase from '@/lib/supabaseClient';

export type PurchaseBillItem = {
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  actual_weight: number; // total weight
  billable_weight: number; // 95% of total weight
  rate_per_kg: number;
  amount: number;
};

export type PurchaseBillDeduction = {
  name: string;
  amount: number;
};

export type PurchaseBillPayment = {
  id?: number;
  purchase_bill_id?: number;
  payment_date: string;
  amount: number;
  payment_mode: 'cash' | 'upi' | 'neft' | 'other';
  notes?: string;
  created_at?: string;
};

export type PurchaseBill = {
  id: number;
  bill_number: string;
  farmer_id: number;
  farmer_name?: string;
  bill_date: string;
  location?: string; // Location where purchase was made
  secondary_name?: string; // Alternate/secondary name for farmer
  items: PurchaseBillItem[];
  gross_amount: number; // Total before any deductions
  weight_deduction_percentage: number; // typically 5%
  weight_deduction_amount: number;
  subtotal: number; // After weight deduction
  commission_per_kg: number; // ₹ per kg
  commission_amount: number;
  other_deductions: PurchaseBillDeduction[]; // ice, transport, etc.
  other_deductions_total: number;
  total: number; // Final amount
  payment_status: 'pending' | 'partial' | 'paid';
  amount_paid: number;
  balance_due: number;
  payments?: PurchaseBillPayment[]; // Payment history
  notes?: string;
  created_at?: string;
};

// Get next purchase bill number
export async function getNextPurchaseBillNumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('purchase_bills')
      .select('bill_number')
      .order('id', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastNumber = parseInt(data[0].bill_number.replace('PB-', '')) || 0;
      return `PB-${String(lastNumber + 1).padStart(4, '0')}`;
    }
    return 'PB-0001';
  } catch (err) {
    console.error('Error getting next purchase bill number:', err);
    return `PB-${Date.now()}`;
  }
}

// Get last rate for a fish variety from purchase bills
export async function getLastPurchaseRateForVariety(varietyId: number): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('purchase_bill_items')
      .select('rate_per_kg')
      .eq('fish_variety_id', varietyId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      return data[0].rate_per_kg || 0;
    }
    return null;
  } catch (err) {
    console.error('Error getting last purchase rate:', err);
    return null;
  }
}

// Get purchases for a date (to create bills from)
export async function getPurchasesForBilling(date: string, farmerId?: number): Promise<any[]> {
  try {
    let query = supabase
      .from('purchases')
      .select('*, farmers(name), fish_varieties(name)')
      .eq('purchase_date', date);

    if (farmerId) {
      query = query.eq('farmer_id', farmerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((p: any) => ({
      id: p.id,
      farmer_id: p.farmer_id,
      farmer_name: p.farmers?.name || 'Unknown',
      fish_variety_id: p.fish_variety_id,
      fish_variety_name: p.fish_varieties?.name || 'Unknown',
      quantity_crates: p.quantity_crates,
      quantity_kg: p.quantity_kg,
    }));
  } catch (err) {
    console.error('Error getting purchases for billing:', err);
    return [];
  }
}

// Create a new purchase bill
export async function createPurchaseBill(
  farmerId: number,
  billDate: string,
  items: Omit<PurchaseBillItem, 'amount'>[],
  commissionPerKg: number = 0.5,
  weightDeductionPercentage: number = 5, // default 5%
  otherDeductions: PurchaseBillDeduction[] = [],
  notes?: string,
  initialPayment?: { amount: number; payment_date: string; payment_mode: 'cash' | 'upi' | 'neft' | 'other'; notes?: string },
  location?: string,
  secondaryName?: string
): Promise<PurchaseBill | null> {
  try {
    const billNumber = await getNextPurchaseBillNumber();

    // Calculate amounts
    const itemsWithAmount = items.map(item => {
      // Calculate billable weight (e.g., 95% of actual weight)
      const actualWeight = item.actual_weight;
      const billableWeight = actualWeight * (1 - weightDeductionPercentage / 100);

      return {
        ...item,
        billable_weight: billableWeight,
        amount: billableWeight * item.rate_per_kg,
      };
    });

    // Calculate gross amount (before weight deduction)
    const grossAmount = items.reduce((sum, item) => sum + (item.actual_weight * item.rate_per_kg), 0);

    // Weight deduction amount
    const weightDeductionAmount = grossAmount * (weightDeductionPercentage / 100);

    // Subtotal after weight deduction
    const subtotal = itemsWithAmount.reduce((sum, item) => sum + item.amount, 0);

    // Commission = ₹ per kg (ADDED to bill, not subtracted)
    const totalBillableWeight = itemsWithAmount.reduce((sum, item) => sum + item.billable_weight, 0);
    const commissionAmount = totalBillableWeight * commissionPerKg;

    // Other deductions
    const otherDeductionsTotal = otherDeductions.reduce((sum, d) => sum + d.amount, 0);

    // Final total (commission is ADDED)
    const total = subtotal + commissionAmount - otherDeductionsTotal;

    const amountPaid = initialPayment?.amount || 0;
    const balanceDue = total - amountPaid;

    // Determine payment status
    let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
    if (amountPaid >= total) {
      paymentStatus = 'paid';
    } else if (amountPaid > 0) {
      paymentStatus = 'partial';
    }

    // Insert bill
    const { data: billData, error: billError } = await supabase
      .from('purchase_bills')
      .insert({
        bill_number: billNumber,
        farmer_id: farmerId,
        bill_date: billDate,
        location: location || null,
        secondary_name: secondaryName || null,
        gross_amount: grossAmount,
        weight_deduction_percentage: weightDeductionPercentage,
        weight_deduction_amount: weightDeductionAmount,
        subtotal,
        commission_per_kg: commissionPerKg,
        commission_amount: commissionAmount,
        other_deductions: otherDeductions,
        other_deductions_total: otherDeductionsTotal,
        total,
        payment_status: paymentStatus,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        notes: notes || null,
      })
      .select('*, farmers(name)')
      .single();

    if (billError) {
      console.error('Purchase bill insert error:', billError);
      throw billError;
    }

    // Insert initial payment if provided
    if (initialPayment && initialPayment.amount > 0) {
      const { error: paymentError } = await supabase
        .from('purchase_bill_payments')
        .insert({
          purchase_bill_id: billData.id,
          payment_date: initialPayment.payment_date,
          amount: initialPayment.amount,
          payment_mode: initialPayment.payment_mode,
          notes: initialPayment.notes || null,
        });

      if (paymentError) {
        console.error('Payment insert error:', paymentError);
        // Don't throw - bill was created successfully
      }
    }

    // Insert bill items
    const billItems = itemsWithAmount.map(item => ({
      purchase_bill_id: billData.id,
      fish_variety_id: item.fish_variety_id,
      fish_variety_name: item.fish_variety_name,
      quantity_crates: item.quantity_crates,
      quantity_kg: item.quantity_kg,
      actual_weight: item.actual_weight,
      billable_weight: item.billable_weight,
      rate_per_kg: item.rate_per_kg,
      amount: item.amount,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_bill_items')
      .insert(billItems);

    if (itemsError) {
      console.error('Purchase bill items insert error:', itemsError);
      throw itemsError;
    }

    return {
      ...billData,
      farmer_name: billData.farmers?.name,
      items: itemsWithAmount,
    };
  } catch (err: any) {
    console.error('Error creating purchase bill:', err?.message || err);
    return null;
  }
}

// Get purchase bill by ID
export async function getPurchaseBillById(id: number): Promise<PurchaseBill | null> {
  try {
    const { data: billData, error: billError } = await supabase
      .from('purchase_bills')
      .select('*, farmers(name)')
      .eq('id', id)
      .single();

    if (billError) throw billError;

    const { data: itemsData, error: itemsError } = await supabase
      .from('purchase_bill_items')
      .select('*')
      .eq('purchase_bill_id', id);

    if (itemsError) throw itemsError;

    const { data: paymentsData, error: paymentsError } = await supabase
      .from('purchase_bill_payments')
      .select('*')
      .eq('purchase_bill_id', id)
      .order('payment_date', { ascending: false });

    if (paymentsError) throw paymentsError;

    return {
      ...billData,
      farmer_name: billData.farmers?.name,
      items: itemsData || [],
      payments: paymentsData || [],
    };
  } catch (err) {
    console.error('Error getting purchase bill:', err);
    return null;
  }
}

// Get purchase bills by date
export async function getPurchaseBillsByDate(date: string): Promise<PurchaseBill[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_bills')
      .select('*, farmers(name)')
      .eq('bill_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((bill: any) => ({
      ...bill,
      farmer_name: bill.farmers?.name,
      items: [],
    }));
  } catch (err) {
    console.error('Error getting purchase bills by date:', err);
    return [];
  }
}

// Get purchase bills by farmer
export async function getPurchaseBillsByFarmer(farmerId: number): Promise<PurchaseBill[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_bills')
      .select('*, farmers(name)')
      .eq('farmer_id', farmerId)
      .order('bill_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((bill: any) => ({
      ...bill,
      farmer_name: bill.farmers?.name,
      items: [],
    }));
  } catch (err) {
    console.error('Error getting purchase bills by farmer:', err);
    return [];
  }
}

// Update purchase bill payment
export async function updatePurchaseBillPayment(
  billId: number,
  amountPaid: number
): Promise<boolean> {
  try {
    // Get current bill to calculate balance
    const { data: billData, error: fetchError } = await supabase
      .from('purchase_bills')
      .select('total')
      .eq('id', billId)
      .single();

    if (fetchError) throw fetchError;

    const total = billData.total;
    const balanceDue = total - amountPaid;

    let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
    if (amountPaid >= total) {
      paymentStatus = 'paid';
    } else if (amountPaid > 0) {
      paymentStatus = 'partial';
    }

    const { error } = await supabase
      .from('purchase_bills')
      .update({
        amount_paid: amountPaid,
        balance_due: balanceDue,
        payment_status: paymentStatus,
      })
      .eq('id', billId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating purchase bill payment:', err);
    return false;
  }
}

// Delete purchase bill
export async function deletePurchaseBill(id: number): Promise<boolean> {
  try {
    // Delete bill items first
    await supabase.from('purchase_bill_items').delete().eq('purchase_bill_id', id);

    const { error } = await supabase
      .from('purchase_bills')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting purchase bill:', err);
    return false;
  }
}

// Get farmer's pending balance
export async function getFarmerPendingBalance(farmerId: number): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('purchase_bills')
      .select('balance_due')
      .eq('farmer_id', farmerId)
      .in('payment_status', ['pending', 'partial']);

    if (error) throw error;

    const pending = (data || []).reduce((sum, bill) => sum + (bill.balance_due || 0), 0);
    return pending;
  } catch (err) {
    console.error('Error getting farmer balance:', err);
    return 0;
  }
}

// Add payment to purchase bill
export async function addPaymentToPurchaseBill(
  billId: number,
  payment: { payment_date: string; amount: number; payment_mode: 'cash' | 'upi' | 'neft' | 'other'; notes?: string }
): Promise<boolean> {
  try {
    // Get current bill to calculate new balance
    const { data: billData, error: fetchError } = await supabase
      .from('purchase_bills')
      .select('total, amount_paid')
      .eq('id', billId)
      .single();

    if (fetchError) throw fetchError;

    const newAmountPaid = billData.amount_paid + payment.amount;
    const balanceDue = billData.total - newAmountPaid;

    let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
    if (newAmountPaid >= billData.total) {
      paymentStatus = 'paid';
    } else if (newAmountPaid > 0) {
      paymentStatus = 'partial';
    }

    // Insert payment record
    const { error: paymentError } = await supabase
      .from('purchase_bill_payments')
      .insert({
        purchase_bill_id: billId,
        payment_date: payment.payment_date,
        amount: payment.amount,
        payment_mode: payment.payment_mode,
        notes: payment.notes || null,
      });

    if (paymentError) throw paymentError;

    // Update bill totals
    const { error: updateError } = await supabase
      .from('purchase_bills')
      .update({
        amount_paid: newAmountPaid,
        balance_due: balanceDue,
        payment_status: paymentStatus,
      })
      .eq('id', billId);

    if (updateError) throw updateError;

    return true;
  } catch (err) {
    console.error('Error adding payment:', err);
    return false;
  }
}

// Get payments for a purchase bill
export async function getPurchaseBillPayments(billId: number): Promise<PurchaseBillPayment[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_bill_payments')
      .select('*')
      .eq('purchase_bill_id', billId)
      .order('payment_date', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('Error getting payments:', err);
    return [];
  }
}

// Update purchase bill location and secondary name
export async function updatePurchaseBillLocationAndName(
  billId: number,
  location?: string,
  secondaryName?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('purchase_bills')
      .update({
        location: location || null,
        secondary_name: secondaryName || null,
      })
      .eq('id', billId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating purchase bill location/name:', err);
    return false;
  }
}

// Update existing purchase bill
export async function updatePurchaseBill(
  billId: number,
  items: Omit<PurchaseBillItem, 'amount'>[],
  commissionPercentage: number = 0,
  weightDeductionPercentage: number = 5,
  otherDeductions: PurchaseBillDeduction[] = [],
  notes?: string,
  amountPaid: number = 0
): Promise<PurchaseBill | null> {
  try {
    // Calculate amounts
    const itemsWithAmount = items.map(item => {
      const actualWeight = item.actual_weight;
      const billableWeight = actualWeight * (1 - weightDeductionPercentage / 100);

      return {
        ...item,
        billable_weight: billableWeight,
        amount: billableWeight * item.rate_per_kg,
      };
    });

    const grossAmount = items.reduce((sum, item) => sum + (item.actual_weight * item.rate_per_kg), 0);
    const weightDeductionAmount = grossAmount * (weightDeductionPercentage / 100);
    const subtotal = itemsWithAmount.reduce((sum, item) => sum + item.amount, 0);
    const commissionAmount = subtotal * (commissionPercentage / 100);
    const otherDeductionsTotal = otherDeductions.reduce((sum, d) => sum + d.amount, 0);
    const total = subtotal - commissionAmount - otherDeductionsTotal;
    const balanceDue = total - amountPaid;

    let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
    if (amountPaid >= total) {
      paymentStatus = 'paid';
    } else if (amountPaid > 0) {
      paymentStatus = 'partial';
    }

    // Update bill
    const { data: billData, error: billError } = await supabase
      .from('purchase_bills')
      .update({
        gross_amount: grossAmount,
        weight_deduction_percentage: weightDeductionPercentage,
        weight_deduction_amount: weightDeductionAmount,
        subtotal,
        commission_percentage: commissionPercentage,
        commission_amount: commissionAmount,
        other_deductions: otherDeductions,
        other_deductions_total: otherDeductionsTotal,
        total,
        payment_status: paymentStatus,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        notes: notes || null,
      })
      .eq('id', billId)
      .select('*, farmers(name)')
      .single();

    if (billError) {
      console.error('Purchase bill update error:', billError);
      throw billError;
    }

    // Delete old items and insert new ones
    await supabase.from('purchase_bill_items').delete().eq('purchase_bill_id', billId);

    const billItems = itemsWithAmount.map(item => ({
      purchase_bill_id: billId,
      fish_variety_id: item.fish_variety_id,
      fish_variety_name: item.fish_variety_name,
      quantity_crates: item.quantity_crates,
      quantity_kg: item.quantity_kg,
      actual_weight: item.actual_weight,
      billable_weight: item.billable_weight,
      rate_per_kg: item.rate_per_kg,
      amount: item.amount,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_bill_items')
      .insert(billItems);

    if (itemsError) {
      console.error('Purchase bill items insert error:', itemsError);
      throw itemsError;
    }

    return {
      ...billData,
      farmer_name: billData.farmers?.name,
      items: itemsWithAmount,
    };
  } catch (err: any) {
    console.error('Error updating purchase bill:', err?.message || err);
    return null;
  }
}
