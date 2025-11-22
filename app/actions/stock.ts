'use server';

import supabase from '@/lib/supabaseClient';

export type Purchase = {
  id: number;
  farmer_id: number;
  farmer_name?: string;
  fish_variety_id: number;
  fish_variety_name?: string;
  quantity_crates: number;
  quantity_kg: number;
  purchase_date: string;
};

export type Sale = {
  id: number;
  customer_id: number;
  customer_name?: string;
  fish_variety_id: number;
  fish_variety_name?: string;
  quantity_crates: number;
  quantity_kg: number;
  sale_date: string;
};

export type FishVariety = {
  id: number;
  name: string;
};

export type Farmer = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  bank_account?: string;
  bank_name?: string;
  notes?: string;
};

export type Customer = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  contact_person?: string;
  business_type?: string;
  notes?: string;
};

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
    const { data, error } = await supabase
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

// Fetch all purchases ever (for cumulative stock calculation)
export async function getAllPurchases(): Promise<Purchase[]> {
  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('*, farmers(name), fish_varieties(name)')
      .order('purchase_date', { ascending: true });

    if (error) throw error;
    
    return (data || []).map((item: any) => ({
      ...item,
      farmer_name: item.farmers?.name,
      fish_variety_name: item.fish_varieties?.name,
    }));
  } catch (err) {
    console.error('Error fetching all purchases:', err);
    return [];
  }
}

// Fetch all sales up to a specific date
export async function getAllSalesUpToDate(date: string): Promise<Sale[]> {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(name), fish_varieties(name)')
      .lte('sale_date', date)
      .order('sale_date', { ascending: true });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      customer_name: item.customers?.name,
      fish_variety_name: item.fish_varieties?.name,
    }));
  } catch (err) {
    console.error('Error fetching sales up to date:', err);
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

// Add or update a sale (upsert logic to prevent duplicates)
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
      // Update existing record instead of creating duplicate
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

    // No existing record, create new one
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

// Clean up duplicate sales records (keeps only the latest one per customer+variety+date)
export async function cleanupDuplicateSales(saleDate: string): Promise<{ deleted: number }> {
  try {
    // Get all sales for this date
    const { data: allSales, error: fetchError } = await supabase
      .from('sales')
      .select('id, customer_id, fish_variety_id, created_at')
      .eq('sale_date', saleDate)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    if (!allSales || allSales.length === 0) return { deleted: 0 };

    // Find duplicates - keep only the latest (first in sorted array) for each customer+variety
    const seen = new Set<string>();
    const idsToDelete: number[] = [];

    for (const sale of allSales) {
      const key = `${sale.customer_id}-${sale.fish_variety_id}`;
      if (seen.has(key)) {
        // This is a duplicate, mark for deletion
        idsToDelete.push(sale.id);
      } else {
        seen.add(key);
      }
    }

    // Delete duplicates
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

// ============ MANAGEMENT FUNCTIONS ============

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
