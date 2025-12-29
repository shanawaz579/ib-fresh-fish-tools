// Shared TypeScript types for both web and mobile apps

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

export type Bill = {
  id: number;
  bill_number: string;
  customer_id: number;
  bill_date: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  created_at?: string;
};

export type BillItem = {
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  rate_per_crate: number;
  rate_per_kg: number;
  amount: number;
};
