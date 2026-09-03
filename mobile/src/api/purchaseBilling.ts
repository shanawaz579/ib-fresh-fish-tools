import supabase from '../lib/supabase';
import type { PurchaseBillSummary } from '../domain/purchaseBills';
import type { SupplierLedgerAccount, SupplierLedgerEntry } from '../domain/supplierLedger';

export type PurchaseBillItem = {
  purchase_id: number;
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  actual_weight: number;
  billable_weight: number;
  rate_per_kg: number;
  amount: number;
};

export type CreatePurchaseBillParams = {
  supplier_id: number;
  bill_date: string;
  items: PurchaseBillItem[];
  commission_per_kg: number;
  payment_amount: number;
  payment_mode: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  payment_reference?: string;
  other_charges_addition: number;
  other_charges_deduction: number;
  notes?: string;
  location?: string;
};

export async function createPurchaseBill(params: CreatePurchaseBillParams): Promise<{ success: boolean; bill_id?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('create_purchase_bill_with_payment', {
      p_supplier_id: params.supplier_id,
      p_bill_date: params.bill_date,
      p_items: params.items,
      p_commission_per_kg: params.commission_per_kg,
      p_payment_amount: params.payment_amount,
      p_payment_mode: params.payment_mode,
      p_payment_reference: params.payment_reference?.trim() || null,
      p_other_charges_addition: params.other_charges_addition,
      p_other_charges_deduction: params.other_charges_deduction,
      p_notes: params.notes || null,
      p_location: params.location || null,
    });

    if (error) throw error;
    const createdBill = Array.isArray(data) ? data[0] : data;
    if (!createdBill?.id) throw new Error('Database did not return the created purchase bill');
    return { success: true, bill_id: createdBill.id };
  } catch (error) {
    console.error('Error creating purchase bill:', error);
    return { success: false, error: String(error) };
  }
}

export async function revisePurchaseBill(
  purchaseBillId: number,
  reason: string,
  params: CreatePurchaseBillParams,
): Promise<{ success: boolean; bill_id?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('revise_purchase_bill_with_source_changes', {
      p_purchase_bill_id: purchaseBillId,
      p_reason: reason.trim(),
      p_supplier_id: params.supplier_id,
      p_bill_date: params.bill_date,
      p_items: params.items,
      p_commission_per_kg: params.commission_per_kg,
      p_payment_amount: params.payment_amount,
      p_payment_mode: params.payment_mode,
      p_payment_reference: params.payment_reference?.trim() || null,
      p_other_charges_addition: params.other_charges_addition,
      p_other_charges_deduction: params.other_charges_deduction,
      p_notes: params.notes || null,
      p_location: params.location || null,
    });
    if (error) throw error;
    const revisedBill = Array.isArray(data) ? data[0] : data;
    if (!revisedBill?.id) throw new Error('Database did not return the corrected purchase bill');
    return { success: true, bill_id: revisedBill.id };
  } catch (error) {
    console.error('Error revising purchase bill:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getPurchaseBills(): Promise<PurchaseBillSummary[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_bills')
      .select(`
        *,
        suppliers (
          id,
          name,
          supplier_type
        )
      `)
      .order('bill_date', { ascending: false });

    if (error) throw error;

    const bills = data?.map(bill => ({
      ...bill,
      supplier_name: bill.suppliers?.name,
    })) || [];

    return bills;
  } catch (error) {
    console.error('Error fetching purchase bills:', error);
    return [];
  }
}

export async function getPurchaseBillDetails(billId: number): Promise<any> {
  try {
    // Fetch bill details with primary supplier account info.
    const { data: billData, error: billError } = await supabase
      .from('purchase_bills')
      .select(`
        *,
        suppliers (
          id,
          name,
          supplier_type
        )
      `)
      .eq('id', billId)
      .single();

    if (billError) throw billError;

    // Fetch bill items
    const { data: itemsData, error: itemsError } = await supabase
      .from('purchase_bill_items')
      .select('*')
      .eq('purchase_bill_id', billId)
      .order('id', { ascending: true });

    if (itemsError) throw itemsError;

    // Fetch payments
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('purchase_bill_payments')
      .select('*')
      .eq('purchase_bill_id', billId)
      .order('payment_date', { ascending: false });

    if (paymentsError) throw paymentsError;

    // Combine all data
    const billDetails = {
      ...billData,
      supplier_name: billData.suppliers?.name,
      supplier_type: billData.suppliers?.supplier_type,
      items: itemsData || [],
      payments: paymentsData || [],
    };

    return billDetails;
  } catch (error) {
    console.error('Error fetching purchase bill details:', error);
    throw error;
  }
}

export async function getSupplierPaymentLedger(): Promise<SupplierLedgerAccount[]> {
  const [{ data, error }, { data: detachedPayments, error: detachedError }] = await Promise.all([
    supabase
      .from('purchase_bills')
      .select(`
        id,
        bill_number,
        bill_date,
        supplier_id,
        total,
        amount_paid,
        balance_due,
        suppliers (id, name),
        purchase_bill_payments (
          id,
          payment_date,
          amount,
          payment_mode,
          reference_number,
          voided_at
        )
      `)
      .order('bill_date', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('purchase_bill_payments')
      .select('id, supplier_id, bill_number_snapshot, payment_date, amount, payment_mode, reference_number, voided_at, suppliers(id, name)')
      .is('purchase_bill_id', null)
      .order('payment_date', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  if (error) throw error;
  if (detachedError) throw detachedError;

  type AccountAccumulator = {
    supplierName: string;
    totalBilled: number;
    totalPaid: number;
    balanceDue: number;
    rawEntries: Array<Omit<SupplierLedgerEntry, 'balanceAfter'> & { sortOrder: number }>;
  };

  const accounts = new Map<number, AccountAccumulator>();

  for (const bill of data ?? []) {
    const supplier = Array.isArray(bill.suppliers) ? bill.suppliers[0] : bill.suppliers;
    const current: AccountAccumulator = accounts.get(bill.supplier_id) ?? {
      supplierName: supplier?.name ?? 'Unknown Supplier',
      totalBilled: 0,
      totalPaid: 0,
      balanceDue: 0,
      rawEntries: [],
    };

    current.totalBilled += Number(bill.total);
    current.totalPaid += Number(bill.amount_paid);
    current.balanceDue += Number(bill.balance_due);
    current.rawEntries.push({
      key: `bill-${bill.id}`,
      type: 'bill',
      date: bill.bill_date,
      billId: bill.id,
      billNumber: bill.bill_number,
      amount: Number(bill.total),
      sortOrder: bill.id * 2,
    });

    for (const payment of bill.purchase_bill_payments ?? []) {
      current.rawEntries.push({
        key: `payment-${payment.id}`,
        type: payment.voided_at ? 'voided_payment' : 'payment',
        date: payment.payment_date,
        billId: bill.id,
        billNumber: bill.bill_number,
        amount: Number(payment.amount),
        paymentMode: payment.payment_mode,
        referenceNumber: payment.reference_number ?? undefined,
        sortOrder: bill.id * 2 + 1 + payment.id / 1_000_000,
      });
    }

    accounts.set(bill.supplier_id, current);
  }

  for (const payment of detachedPayments ?? []) {
    const supplier = Array.isArray(payment.suppliers) ? payment.suppliers[0] : payment.suppliers;
    const current: AccountAccumulator = accounts.get(payment.supplier_id) ?? {
      supplierName: supplier?.name ?? 'Unknown Supplier',
      totalBilled: 0,
      totalPaid: 0,
      balanceDue: 0,
      rawEntries: [],
    };
    current.rawEntries.push({
      key: `detached-payment-${payment.id}`,
      type: 'voided_payment',
      date: payment.payment_date,
      billNumber: payment.bill_number_snapshot ?? 'Deleted bill',
      amount: Number(payment.amount),
      paymentMode: payment.payment_mode,
      referenceNumber: payment.reference_number ?? undefined,
      sortOrder: payment.id * 2 + 1,
    });
    accounts.set(payment.supplier_id, current);
  }

  return [...accounts.entries()]
    .map(([supplierId, account]) => {
      let runningBalance = 0;
      const entries = account.rawEntries
        .sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder)
        .map(({ sortOrder: _sortOrder, ...entry }) => {
          if (entry.type === 'bill') runningBalance += entry.amount;
          if (entry.type === 'payment') runningBalance -= entry.amount;
          return { ...entry, balanceAfter: runningBalance };
        })
        .reverse();

      return {
        supplierId,
        supplierName: account.supplierName,
        totalBilled: account.totalBilled,
        totalPaid: account.totalPaid,
        balanceDue: account.balanceDue,
        entries,
      };
    })
    .sort((a, b) => b.balanceDue - a.balanceDue || a.supplierName.localeCompare(b.supplierName));
}

// Create purchase bill payment

export async function createPurchaseBillPayment(
  purchaseBillId: number,
  paymentDate: string,
  amount: number,
  paymentMode: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other',
  referenceNumber?: string,
  notes?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('record_purchase_bill_payment', {
      p_purchase_bill_id: purchaseBillId,
      p_payment_date: paymentDate,
      p_amount: amount,
      p_payment_mode: paymentMode,
      p_reference_number: referenceNumber?.trim() || null,
      p_notes: notes?.trim() || null,
    });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error creating purchase bill payment:', error);
    throw error;
  }
}

// Void a payment without erasing its audit history.

export async function voidPurchaseBillPayment(paymentId: number, reason: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('void_purchase_bill_payment', {
      p_payment_id: paymentId,
      p_void_reason: reason.trim(),
    });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error voiding purchase bill payment:', error);
    throw error;
  }
}

export async function releasePurchaseBillForCorrection(
  purchaseBillId: number,
  reason: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('release_purchase_bill_for_correction', {
    p_purchase_bill_id: purchaseBillId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
  if (!data) throw new Error('Purchase bill was not found');
}
