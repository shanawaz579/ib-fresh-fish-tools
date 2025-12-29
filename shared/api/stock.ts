import supabase from '../lib/supabase';
import type { Purchase, Sale, FishVariety, Farmer, Customer, Bill, BillItem } from '../types';

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
  purchaseDate: string
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
  quantityKg: number
): Promise<Purchase | null> {
  try {
    const { data, error } = await supabase
      .from('purchases')
      .update({
        farmer_id: farmerId,
        fish_variety_id: fishVarietyId,
        quantity_crates: quantityCrates,
        quantity_kg: quantityKg,
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
  address?: string
): Promise<Farmer | null> {
  try {
    const { data, error } = await supabase
      .from('farmers')
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
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

// Add a new customer
export async function addCustomer(
  name: string,
  phone?: string,
  email?: string,
  address?: string
): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
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
  discount: number = 0,
  notes?: string
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
        notes: notes || null,
      })
      .select()
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
      items: itemsWithAmount,
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

// Get bill by ID with items
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

    return {
      ...billData,
      items: itemsData || [],
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
