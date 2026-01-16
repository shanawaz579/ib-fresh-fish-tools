import supabase from '../lib/supabase';
import type {
  Purchase,
  Sale,
  FishVariety,
  Farmer,
  Customer,
  Bill,
  BillItem,
  BillOtherCharge,
  Payment,
  CustomerLedger,
  LedgerTransaction
} from '../types';

// Fetch all fish varieties
export async function getFishVarieties(): Promise<FishVariety[]> {
  try {
    const { data, error } = await supabase
      .from('fish_varieties')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching fish varieties:', err);
    return [];
  }
}

// Fetch all farmers
export async function getFarmers(): Promise<Farmer[]> {
  try {
    const { data, error } = await supabase
      .from('farmers')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching farmers:', err);
    return [];
  }
}

// Fetch all customers
export async function getCustomers(): Promise<Customer[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching customers:', err);
    return [];
  }
}

// Fetch purchases for a specific date
export async function getPurchasesByDate(date: string): Promise<Purchase[]> {
  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('*, farmers(name), fish_varieties(name)')
      .eq('purchase_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      farmer_name: item.farmers?.name,
      fish_variety_name: item.fish_varieties?.name,
    }));
  } catch (err) {
    console.error('Error fetching purchases:', err);
    return [];
  }
}

// Fetch sales for a specific date
export async function getSalesByDate(date: string): Promise<Sale[]> {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(name), fish_varieties(name)')
      .eq('sale_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      customer_name: item.customers?.name,
      fish_variety_name: item.fish_varieties?.name,
    }));
  } catch (err) {
    console.error('Error fetching sales:', err);
    return [];
  }
}

// Add a new purchase
export async function addPurchase(
  farmerId: number,
  fishVarietyId: number,
  quantityCrates: number,
  quantityKg: number,
  purchaseDate: string,
  location?: string,
  secondaryName?: string
): Promise<Purchase | null> {
  try {
    const { data, error } = await supabase
      .from('purchases')
      .insert({
        farmer_id: farmerId,
        fish_variety_id: fishVarietyId,
        quantity_crates: quantityCrates,
        quantity_kg: quantityKg,
        purchase_date: purchaseDate,
        location: location || null,
        secondary_name: secondaryName || null,
      })
      .select('*, farmers(name), fish_varieties(name)')
      .single();

    if (error) throw error;

    return {
      ...data,
      farmer_name: data.farmers?.name,
      fish_variety_name: data.fish_varieties?.name,
    };
  } catch (err) {
    console.error('Error adding purchase:', err);
    return null;
  }
}

// Add or update a sale
export async function addSale(
  customerId: number,
  fishVarietyId: number,
  quantityCrates: number,
  quantityKg: number,
  saleDate: string
): Promise<Sale | null> {
  try {
    // First, check if a sale already exists for this customer+variety+date
    const { data: existing } = await supabase
      .from('sales')
      .select('id')
      .eq('customer_id', customerId)
      .eq('fish_variety_id', fishVarietyId)
      .eq('sale_date', saleDate)
      .limit(1)
      .single();

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('sales')
        .update({
          quantity_crates: quantityCrates,
          quantity_kg: quantityKg,
        })
        .eq('id', existing.id)
        .select('*, customers(name), fish_varieties(name)')
        .single();

      if (error) throw error;

      return {
        ...data,
        customer_name: data.customers?.name,
        fish_variety_name: data.fish_varieties?.name,
      };
    }

    // Create new record
    const { data, error } = await supabase
      .from('sales')
      .insert({
        customer_id: customerId,
        fish_variety_id: fishVarietyId,
        quantity_crates: quantityCrates,
        quantity_kg: quantityKg,
        sale_date: saleDate,
      })
      .select('*, customers(name), fish_varieties(name)')
      .single();

    if (error) throw error;

    return {
      ...data,
      customer_name: data.customers?.name,
      fish_variety_name: data.fish_varieties?.name,
    };
  } catch (err) {
    console.error('Error adding sale:', err);
    return null;
  }
}

// Update a purchase
export async function updatePurchase(
  id: number,
  farmerId: number,
  fishVarietyId: number,
  quantityCrates: number,
  quantityKg: number,
  location?: string,
  secondaryName?: string
): Promise<Purchase | null> {
  try {
    const { data, error } = await supabase
      .from('purchases')
      .update({
        farmer_id: farmerId,
        fish_variety_id: fishVarietyId,
        quantity_crates: quantityCrates,
        quantity_kg: quantityKg,
        location: location || null,
        secondary_name: secondaryName || null,
      })
      .eq('id', id)
      .select('*, farmers(name), fish_varieties(name)')
      .single();

    if (error) throw error;

    return {
      ...data,
      farmer_name: data.farmers?.name,
      fish_variety_name: data.fish_varieties?.name,
    };
  } catch (err) {
    console.error('Error updating purchase:', err);
    return null;
  }
}

// Update a sale
export async function updateSale(
  id: number,
  customerId: number,
  fishVarietyId: number,
  quantityCrates: number,
  quantityKg: number
): Promise<Sale | null> {
  try {
    const { data, error } = await supabase
      .from('sales')
      .update({
        customer_id: customerId,
        fish_variety_id: fishVarietyId,
        quantity_crates: quantityCrates,
        quantity_kg: quantityKg,
      })
      .eq('id', id)
      .select('*, customers(name), fish_varieties(name)')
      .single();

    if (error) throw error;

    return {
      ...data,
      customer_name: data.customers?.name,
      fish_variety_name: data.fish_varieties?.name,
    };
  } catch (err) {
    console.error('Error updating sale:', err);
    return null;
  }
}

// Delete a purchase
export async function deletePurchase(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('purchases')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting purchase:', err);
    return false;
  }
}

// Delete a sale
export async function deleteSale(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting sale:', err);
    return false;
  }
}

// Add a new farmer
export async function addFarmer(
  name: string,
  phone?: string,
  email?: string,
  address?: string,
  city?: string,
  state?: string,
  bank_account?: string,
  bank_name?: string,
  notes?: string
): Promise<Farmer | null> {
  try {
    const { data, error} = await supabase
      .from('farmers')
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        bank_account: bank_account || null,
        bank_name: bank_name || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error adding farmer:', err);
    return null;
  }
}

// Update a farmer
export async function updateFarmer(
  id: number,
  name: string,
  phone?: string,
  email?: string,
  address?: string,
  city?: string,
  state?: string,
  bank_account?: string,
  bank_name?: string,
  notes?: string
): Promise<Farmer | null> {
  try {
    const { data, error } = await supabase
      .from('farmers')
      .update({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        bank_account: bank_account || null,
        bank_name: bank_name || null,
        notes: notes || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating farmer:', err);
    return null;
  }
}

// Delete a farmer
export async function deleteFarmer(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('farmers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting farmer:', err);
    return false;
  }
}

// Add a new customer
export async function addCustomer(
  name: string,
  phone?: string,
  email?: string,
  address?: string,
  city?: string,
  state?: string,
  contact_person?: string,
  business_type?: string,
  notes?: string
): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        contact_person: contact_person || null,
        business_type: business_type || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error adding customer:', err);
    return null;
  }
}

// Update a customer
export async function updateCustomer(
  id: number,
  name: string,
  phone?: string,
  email?: string,
  address?: string,
  city?: string,
  state?: string,
  contact_person?: string,
  business_type?: string,
  notes?: string
): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        contact_person: contact_person || null,
        business_type: business_type || null,
        notes: notes || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating customer:', err);
    return null;
  }
}

// Delete a customer
export async function deleteCustomer(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting customer:', err);
    return false;
  }
}

// Add a new fish variety
export async function addFishVariety(name: string): Promise<FishVariety | null> {
  try {
    const { data, error } = await supabase
      .from('fish_varieties')
      .insert({ name })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error adding fish variety:', err);
    return null;
  }
}

// Update a fish variety
export async function updateFishVariety(id: number, name: string): Promise<FishVariety | null> {
  try {
    const { data, error } = await supabase
      .from('fish_varieties')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating fish variety:', err);
    return null;
  }
}

// Delete a fish variety
export async function deleteFishVariety(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('fish_varieties')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting fish variety:', err);
    return false;
  }
}

// Clean up duplicate sales
export async function cleanupDuplicateSales(saleDate: string): Promise<{ deleted: number }> {
  try {
    const { data: allSales, error: fetchError } = await supabase
      .from('sales')
      .select('id, customer_id, fish_variety_id, created_at')
      .eq('sale_date', saleDate)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    if (!allSales || allSales.length === 0) return { deleted: 0 };

    const seen = new Set<string>();
    const idsToDelete: number[] = [];

    for (const sale of allSales) {
      const key = `${sale.customer_id}-${sale.fish_variety_id}`;
      if (seen.has(key)) {
        idsToDelete.push(sale.id);
      } else {
        seen.add(key);
      }
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;
    }

    return { deleted: idsToDelete.length };
  } catch (err) {
    console.error('Error cleaning up duplicate sales:', err);
    return { deleted: 0 };
  }
}

// ============ BILL FUNCTIONS ============

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
  notes?: string
): Promise<Bill | null> {
  try {
    const billNumber = await getNextBillNumber();

    // Step 1: Get previous active bill for this customer
    const { data: previousBill } = await supabase
      .from('bills')
      .select('id, total, bill_date')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .single();

    const previousBalance = previousBill?.total || 0;
    const previousBillDate = previousBill?.bill_date || '1900-01-01';

    // Step 2: Get all payments made since previous bill (exclusive start, inclusive end)
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .gt('payment_date', previousBillDate)
      .lte('payment_date', billDate)
      .order('payment_date', { ascending: true });

    const payments: Payment[] = paymentsData || [];
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    // Step 3: Calculate bill amounts
    const itemsWithAmount = items.map(item => {
      const totalWeight = (item.quantity_crates * 35) + item.quantity_kg;
      return {
        ...item,
        amount: Math.round(totalWeight * item.rate_per_kg),
      };
    });

    const itemsTotal = itemsWithAmount.reduce((sum, item) => sum + item.amount, 0);
    const chargesTotal = otherCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const subtotal = itemsTotal + chargesTotal;
    const balanceDue = previousBalance - totalPayments;
    const total = balanceDue + subtotal - discount;

    // Step 4: Mark previous bill as inactive (if exists)
    if (previousBill) {
      const { error: updateError } = await supabase
        .from('bills')
        .update({ is_active: false })
        .eq('id', previousBill.id);

      if (updateError) {
        console.error('Error marking previous bill as inactive:', updateError);
        throw new Error('Failed to mark previous bill as inactive');
      }
    }

    // Step 5: Insert new bill
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .insert({
        bill_number: billNumber,
        customer_id: customerId,
        bill_date: billDate,
        previous_balance: previousBalance,
        amount_paid: totalPayments,
        balance_due: balanceDue,
        subtotal,
        discount,
        total,
        status: 'unpaid',
        is_active: true,
        notes: notes || null,
      })
      .select()
      .single();

    if (billError) {
      console.error('Bill insert error:', billError);
      throw billError;
    }

    // Step 6: Insert bill items
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

    // Step 7: Insert other charges if any
    if (otherCharges.length > 0) {
      const chargeRecords = otherCharges.map(charge => ({
        bill_id: billData.id,
        charge_type: charge.charge_type,
        description: charge.description || null,
        amount: charge.amount,
      }));

      const { error: chargesError } = await supabase
        .from('bill_other_charges')
        .insert(chargeRecords);

      if (chargesError) {
        console.error('Bill charges insert error:', chargesError);
        throw chargesError;
      }
    }

    // Return bill with all data
    return {
      ...billData,
      items: itemsWithAmount,
      other_charges: otherCharges,
      payments,
    };
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
      .select('*')
      .eq('bill_id', id);

    if (itemsError) throw itemsError;

    const { data: chargesData, error: chargesError} = await supabase
      .from('bill_other_charges')
      .select('*')
      .eq('bill_id', id);

    if (chargesError) throw chargesError;

    // Get payments that were included in this bill
    // Fetch payments between previous bill date and this bill date
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', billData.customer_id)
      .gte('payment_date', billData.bill_date) // This is simplified - ideally we'd need previous bill date
      .lte('payment_date', billData.bill_date)
      .order('payment_date', { ascending: true });

    return {
      ...billData,
      items: itemsData || [],
      other_charges: chargesData || [],
      payments: paymentsData || [],
    };
  } catch (err) {
    console.error('Error getting bill:', err);
    return null;
  }
}

// Delete bill
export async function deleteBill(id: number): Promise<boolean> {
  try {
    // Delete bill items first
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

// Packing Status Functions

export interface PackingStatus {
  id: number;
  sale_id: number;
  loaded: boolean;
  loaded_at: string | null;
  loaded_by: string | null;
}

// Get packing status for a specific date
export async function getPackingStatusByDate(date: string): Promise<Map<number, boolean>> {
  try {
    const { data: sales } = await supabase
      .from('sales')
      .select('id')
      .eq('sale_date', date);

    if (!sales || sales.length === 0) return new Map();

    const saleIds = sales.map(s => s.id);

    const { data, error } = await supabase
      .from('packing_status')
      .select('sale_id, loaded')
      .in('sale_id', saleIds);

    if (error) throw error;

    const statusMap = new Map<number, boolean>();
    data?.forEach(status => {
      statusMap.set(status.sale_id, status.loaded);
    });

    return statusMap;
  } catch (err) {
    console.error('Error fetching packing status:', err);
    return new Map();
  }
}

// Toggle packing status for a sale
export async function togglePackingStatus(
  saleId: number,
  loaded: boolean,
  userEmail: string
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from('packing_status')
      .select('id')
      .eq('sale_id', saleId)
      .single();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('packing_status')
        .update({
          loaded,
          loaded_at: loaded ? new Date().toISOString() : null,
          loaded_by: loaded ? userEmail : null,
        })
        .eq('sale_id', saleId);

      if (error) throw error;
    } else {
      // Insert new record
      const { error } = await supabase
        .from('packing_status')
        .insert({
          sale_id: saleId,
          loaded,
          loaded_at: loaded ? new Date().toISOString() : null,
          loaded_by: loaded ? userEmail : null,
        });

      if (error) throw error;
    }

    return true;
  } catch (err) {
    console.error('Error toggling packing status:', err);
    return false;
  }
}

// Clear all packing status for a specific date (for resetting at end of day)
export async function clearPackingStatusByDate(date: string): Promise<boolean> {
  try {
    const { data: sales } = await supabase
      .from('sales')
      .select('id')
      .eq('sale_date', date);

    if (!sales || sales.length === 0) return true;

    const saleIds = sales.map(s => s.id);

    const { error } = await supabase
      .from('packing_status')
      .delete()
      .in('sale_id', saleIds);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error clearing packing status:', err);
    return false;
  }
}

// ============ PAYMENT FUNCTIONS ============

// Get customer outstanding balance (only active bill)
export async function getCustomerOutstanding(customerId: number): Promise<{
  total_outstanding: number;
  unpaid_bills_count: number;
  oldest_bill_date: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('total, bill_date, status')
      .eq('customer_id', customerId)
      .eq('status', 'unpaid')
      .eq('is_active', true)
      .order('bill_date', { ascending: true });

    if (error) throw error;

    const total_outstanding = (data || []).reduce((sum, bill) => sum + Number(bill.total), 0);
    const unpaid_bills_count = (data || []).length;
    const oldest_bill_date = (data && data.length > 0) ? data[0].bill_date : null;

    return {
      total_outstanding,
      unpaid_bills_count,
      oldest_bill_date,
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
  try {
    console.log('Creating payment with:', {
      customer_id: customerId,
      payment_date: paymentDate,
      amount,
      payment_method: paymentMethod,
      reference_number: referenceNumber,
      notes,
    });

    // Insert payment
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .insert({
        customer_id: customerId,
        payment_date: paymentDate,
        amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment insert error:', paymentError);
      throw paymentError;
    }

    return paymentData;
  } catch (err: any) {
    console.error('Error creating payment:', err);
    throw err;
  }
}

// Update payment
export async function updatePayment(
  paymentId: number,
  paymentDate: string,
  amount: number,
  paymentMethod: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other',
  referenceNumber?: string,
  notes?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('payments')
      .update({
        payment_date: paymentDate,
        amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        notes: notes || null,
      })
      .eq('id', paymentId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating payment:', err);
    return false;
  }
}

// Delete payment
export async function deletePayment(paymentId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting payment:', err);
    return false;
  }
}

// Get payments by customer
export async function getPaymentsByCustomer(customerId: number): Promise<Payment[]> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false });

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
      .select('id, bill_number, bill_date, total, amount_paid, balance_due, status')
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
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const txn of allTransactions) {
      if (txn.type === 'bill') {
        runningBalance += Number(txn.total);
        transactions.push({
          id: txn.id,
          date: txn.date,
          type: 'bill',
          reference: txn.bill_number,
          debit: Number(txn.total),
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

// ===== PURCHASE BILLS =====

type PurchaseBillItem = {
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

type CreatePurchaseBillParams = {
  farmer_id: number;
  bill_date: string;
  items: PurchaseBillItem[];
  commission_per_kg: number;
  advance_amount: number;
  transport_amount: number;
  notes?: string;
  location?: string;
  secondary_name?: string;
};

export async function createPurchaseBill(params: CreatePurchaseBillParams): Promise<{ success: boolean; bill_id?: number; error?: string }> {
  try {
    // Calculate totals
    const grossAmount = params.items.reduce((sum, item) => sum + (item.actual_weight * item.rate_per_kg), 0);
    const totalBillableWeight = params.items.reduce((sum, item) => sum + item.billable_weight, 0);
    const weightDeductionAmount = grossAmount - params.items.reduce((sum, item) => sum + item.amount, 0);
    const subtotal = params.items.reduce((sum, item) => sum + item.amount, 0);
    const commissionAmount = totalBillableWeight * params.commission_per_kg;
    const otherDeductionsTotal = params.advance_amount + params.transport_amount;
    const total = subtotal + commissionAmount - otherDeductionsTotal;

    // Generate bill number
    const { data: lastBill } = await supabase
      .from('purchase_bills')
      .select('bill_number')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    let billNumber = 'PB-0001';
    if (lastBill?.bill_number) {
      const lastNumber = parseInt(lastBill.bill_number.split('-')[1]);
      billNumber = `PB-${String(lastNumber + 1).padStart(4, '0')}`;
    }

    // Create other deductions array
    const otherDeductions = [];
    if (params.advance_amount > 0) {
      otherDeductions.push({ type: 'advance', amount: params.advance_amount });
    }
    if (params.transport_amount > 0) {
      otherDeductions.push({ type: 'transport', amount: params.transport_amount });
    }

    // Insert purchase bill
    const { data: bill, error: billError } = await supabase
      .from('purchase_bills')
      .insert({
        bill_number: billNumber,
        farmer_id: params.farmer_id,
        bill_date: params.bill_date,
        gross_amount: grossAmount,
        weight_deduction_percentage: 5, // Always 5%
        weight_deduction_amount: weightDeductionAmount,
        subtotal: subtotal,
        commission_per_kg: params.commission_per_kg,
        commission_amount: commissionAmount,
        other_deductions: otherDeductions,
        other_deductions_total: otherDeductionsTotal,
        total: total,
        payment_status: 'pending',
        amount_paid: 0,
        balance_due: total,
        notes: params.notes,
        location: params.location,
        secondary_name: params.secondary_name,
      })
      .select('id')
      .single();

    if (billError) throw billError;

    // Insert bill items
    const billItems = params.items.map(item => ({
      purchase_bill_id: bill.id,
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

    if (itemsError) throw itemsError;

    // Update purchases billing_status and link to bill
    const purchaseIds = params.items.map(item => item.purchase_id);
    const { error: updateError } = await supabase
      .from('purchases')
      .update({
        billing_status: 'billed',
        billed_in_bill_id: bill.id,
      })
      .in('id', purchaseIds);

    if (updateError) throw updateError;

    return { success: true, bill_id: bill.id };
  } catch (error) {
    console.error('Error creating purchase bill:', error);
    return { success: false, error: String(error) };
  }
}

export async function getPurchaseBills(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_bills')
      .select(`
        *,
        farmers (
          id,
          name
        )
      `)
      .order('bill_date', { ascending: false });

    if (error) throw error;

    // Map the data to include farmer_name
    const bills = data?.map(bill => ({
      ...bill,
      farmer_name: bill.farmers?.name,
    })) || [];

    return bills;
  } catch (error) {
    console.error('Error fetching purchase bills:', error);
    return [];
  }
}

export async function getPurchaseBillDetails(billId: number): Promise<any> {
  try {
    // Fetch bill details with farmer info
    const { data: billData, error: billError } = await supabase
      .from('purchase_bills')
      .select(`
        *,
        farmers (
          id,
          name
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
      farmer_name: billData.farmers?.name,
      items: itemsData || [],
      payments: paymentsData || [],
    };

    return billDetails;
  } catch (error) {
    console.error('Error fetching purchase bill details:', error);
    throw error;
  }
}
