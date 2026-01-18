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
  location?: string;
  secondary_name?: string;
  billing_status?: 'unbilled' | 'billed' | 'partial'; // New field - optional for backward compatibility
  billed_in_bill_id?: number; // Reference to purchase bill - optional
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
  billing_status?: 'unbilled' | 'billed' | 'partial'; // New field - optional for backward compatibility
  billed_in_bill_id?: number; // Reference to sales bill - optional
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
  other_charges?: BillOtherCharge[];
  payments?: Payment[]; // Payments made between previous bill and this bill
  previous_balance: number; // Outstanding from previous bill
  subtotal: number; // Items + Other Charges
  discount: number;
  total: number; // Previous Balance - Payments + Subtotal
  amount_paid: number; // Total payments since previous bill
  balance_due: number; // Previous Balance - Payments
  status: 'unpaid' | 'paid';
  is_active?: boolean; // Whether this is the current active bill
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

export type BillOtherCharge = {
  id?: number;
  bill_id?: number;
  charge_type: 'packing' | 'ice' | 'transport' | 'loading' | 'unloading' | 'other';
  description?: string;
  amount: number;
};

export type Payment = {
  id: number;
  customer_id: number;
  payment_date: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
  reference_number?: string;
  notes?: string;
  created_at?: string;
};

export type PurchaseBillPayment = {
  id: number;
  purchase_bill_id: number;
  payment_date: string;
  amount: number;
  payment_mode: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
  notes?: string;
  created_at?: string;
};

export type CustomerLedger = {
  customer_id: number;
  customer_name: string;
  total_outstanding: number;
  unpaid_bills_count: number;
  oldest_bill_date?: string;
  transactions: LedgerTransaction[];
};

export type LedgerTransaction = {
  id: number;
  date: string;
  type: 'bill' | 'payment';
  reference: string;
  debit?: number;
  credit?: number;
  balance: number;
  status?: string;
};
