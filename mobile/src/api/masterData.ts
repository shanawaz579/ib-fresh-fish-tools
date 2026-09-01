import supabase from '../lib/supabase';
import type { Customer, Farmer, FishVariety, Supplier, SupplierCreateInput } from '../types';

export async function getFishVarieties(): Promise<FishVariety[]> {
  try {
    const { data, error } = await supabase
      .from('item_variants')
      .select(`
        *,
        item:items!inner(
          code,
          name,
          is_active,
          default_kg_per_crate,
          primary_unit:units!items_primary_unit_id_fkey(code),
          secondary_unit:units!items_secondary_unit_id_fkey(code),
          inventory_unit:units!items_inventory_unit_id_fkey(code)
        ),
        grade:item_grades!inner(code, name, sort_order)
      `)
      .eq('is_active', true)
      .eq('item.is_active', true)
      .order('name');

    if (error) throw error;

    return ((data ?? []) as any[]).map((variant) => ({
      ...variant,
      item_code: variant.item?.code,
      item_name: variant.item?.name,
      grade_code: variant.grade?.code,
      grade_name: variant.grade?.name,
      grade_sort_order: variant.grade?.sort_order,
      primary_unit_code: variant.item?.primary_unit?.code,
      secondary_unit_code: variant.item?.secondary_unit?.code,
      inventory_unit_code: variant.item?.inventory_unit?.code,
      default_kg_per_crate: variant.item?.default_kg_per_crate,
    }));
  } catch (err) {
    console.error('Error fetching item variants:', err);
    return [];
  }
}

// Fetch primary payable purchase accounts.

export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    return [];
  }
}

export async function getFarmers(): Promise<Farmer[]> {
  const { data, error } = await supabase
    .from('farmers')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function addFarmer(name: string, location?: string): Promise<Farmer> {
  const { data, error } = await supabase
    .from('farmers')
    .insert({
      name: name.trim().replace(/\s+/g, ' '),
      location: location?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
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

export async function addSupplier(input: SupplierCreateInput): Promise<Supplier | null> {
  try {
    const { data, error} = await supabase
      .from('suppliers')
      .insert({
        supplier_type: input.supplierType,
        name: input.name.trim(),
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        bank_account: input.bankAccount || null,
        bank_name: input.bankName || null,
        notes: input.notes || null,
        location: input.location.trim(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error adding supplier:', err);
    return null;
  }
}

// Update a farmer

export async function updateSupplier(id: number, input: SupplierCreateInput): Promise<Supplier | null> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        supplier_type: input.supplierType,
        name: input.name.trim(),
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        bank_account: input.bankAccount || null,
        bank_name: input.bankName || null,
        notes: input.notes || null,
        location: input.location.trim(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating supplier:', err);
    return null;
  }
}

// Delete a farmer

export async function deleteSupplier(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting supplier:', err);
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

// Clean up duplicate sales
