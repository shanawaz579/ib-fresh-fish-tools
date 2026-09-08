// Shared TypeScript types for both web and mobile apps

export type BusinessProfile = {
  id: 1;
  display_name: string;
  legal_name: string | null;
  tagline: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  primary_color: string;
  created_at: string;
  updated_at: string;
};

export type BusinessTerminology = {
  item: string;
  supplier: string;
  mediator: string;
  farmer: string;
  customer: string;
  crate: string;
  weight: string;
};

export type BusinessModules = {
  purchases: boolean;
  sales: boolean;
  packing: boolean;
  inventory: boolean;
  customer_billing: boolean;
  supplier_billing: boolean;
  expenses: boolean;
  cashbook: boolean;
  profitability: boolean;
};

export type BusinessPreferences = {
  id: 1;
  currency_code: string;
  currency_symbol: string;
  locale: string;
  timezone: string;
  default_crate_weight_kg: number;
  purchase_weight_deduction_percent: number;
  mediator_commission_per_kg: number;
  direct_commission_per_kg: number;
  apply_mediator_commission_by_default: boolean;
  apply_direct_commission_by_default: boolean;
  terminology: BusinessTerminology;
  enabled_modules: BusinessModules;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessConfiguration = {
  profile: BusinessProfile;
  preferences: BusinessPreferences;
};

export type ExpensePaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';

export type ExpenseCategory = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: number;
  expense_date: string;
  category_id: number;
  amount: number;
  payment_method: ExpensePaymentMethod;
  payee: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  category?: Pick<ExpenseCategory, 'id' | 'code' | 'name'> | null;
};

export type CashDirection = 'in' | 'out';

export type CashAdjustment = {
  id: number;
  business_date: string;
  direction: CashDirection;
  amount: number;
  reason: string;
  reference_number: string | null;
  created_by: string | null;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
};

export type CashDayClosing = {
  id: number;
  business_date: string;
  opening_cash: number;
  cash_received: number;
  cash_supplier_payments: number;
  cash_expenses: number;
  cash_adjustments_in: number;
  cash_adjustments_out: number;
  expected_closing_cash: number;
  counted_cash: number;
  difference: number;
  notes: string | null;
  closed_by: string | null;
  closed_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  readiness_snapshot: DayCloseReadiness | Record<string, never>;
  lock_version: number;
};

export type DayCloseIssueSeverity = 'blocker' | 'warning';

export type DayCloseIssue = {
  severity: DayCloseIssueSeverity;
  code: string;
  label: string;
  count: number;
  amount?: number;
};

export type DayCloseReadiness = {
  business_date: string;
  status: 'ready' | 'blocked' | 'closed';
  is_closed: boolean;
  can_close: boolean;
  blocker_count: number;
  warning_count: number;
  issues: DayCloseIssue[];
  activity: {
    purchases: number;
    sales: number;
    purchase_bills: number;
    sales_bills: number;
  };
};

export type CashbookDay = {
  business_date: string;
  opening_cash: number;
  cash_received: number;
  cash_supplier_payments: number;
  cash_expenses: number;
  cash_adjustments_in: number;
  cash_adjustments_out: number;
  expected_closing_cash: number;
  is_closed: boolean;
  closing: CashDayClosing | null;
};

export type CashbookEntryType = 'customer_receipt' | 'supplier_payment' | 'expense' | 'adjustment';

export type CashbookEntry = {
  entry_type: CashbookEntryType;
  source_id: number;
  business_date: string;
  direction: CashDirection;
  amount: number;
  label: string;
  detail: string;
  reference_number: string | null;
  occurred_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

export type ProfitabilityItemRow = {
  item_variant_id: number;
  item_name: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  sale_count: number;
  unresolved_count: number;
};

export type ProfitabilityDayRow = {
  business_date: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  unresolved_count: number;
};

export type ProfitabilityReport = {
  run_id: number;
  costing_method: 'weighted_average';
  date_from: string;
  date_to: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
  sale_count: number;
  complete_sale_count: number;
  unresolved_sale_count: number;
  coverage_percent: number;
  is_complete: boolean;
  items: ProfitabilityItemRow[];
  days: ProfitabilityDayRow[];
};

export type Purchase = {
  id: number;
  supplier_id: number;
  supplier_name?: string;
  supplier_type?: SupplierType;
  farmer_id: number;
  farmer_name?: string;
  fish_variety_id: number;
  fish_variety_name?: string;
  default_kg_per_crate?: number;
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

export type UnitOfMeasure = {
  id: number;
  code: string;
  name: string;
  decimal_places: number;
  is_active: boolean;
};

export type ItemGrade = {
  id: number;
  code: 'S' | 'M' | 'B' | 'OB' | string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type ItemVariant = {
  id: number;
  item_id: number;
  grade_id: number;
  variant_code: string;
  name: string;
  is_active: boolean;
  grade_code?: string;
  grade_name?: string;
  grade_sort_order?: number;
  item_code?: string;
  item_name?: string;
  primary_unit_code?: string;
  secondary_unit_code?: string;
  inventory_unit_code?: string;
  default_kg_per_crate?: number;
};

// Compatibility name while purchase and sales modules move to catalog terminology.
export type FishVariety = ItemVariant;

export type CatalogItem = {
  id: number;
  code: string;
  name: string;
  primary_unit_id: number;
  secondary_unit_id: number | null;
  inventory_unit_id: number;
  default_kg_per_crate: number | null;
  is_active: boolean;
  primary_unit: UnitOfMeasure;
  secondary_unit: UnitOfMeasure | null;
  inventory_unit: UnitOfMeasure;
  variants: ItemVariant[];
};

export type CatalogItemInput = {
  id?: number;
  name: string;
  code: string;
  gradeCodes: string[];
  primaryUnitCode: string;
  secondaryUnitCode: string;
  inventoryUnitCode: string;
  defaultKgPerCrate: number;
};

export type SupplierType = 'mediator' | 'farmer';

export type Supplier = {
  id: number;
  supplier_type: SupplierType;
  name: string;
  location: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  bank_account?: string;
  bank_name?: string;
  notes?: string;
};

export type SupplierCreateInput = {
  supplierType: SupplierType;
  name: string;
  location: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  bankAccount?: string;
  bankName?: string;
  notes?: string;
};

export type Farmer = {
  id: number;
  name: string;
  phone?: string;
  location?: string;
  notes?: string;
  is_active?: boolean;
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
  opening_balance?: number;
  opening_balance_date?: string;
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
  sale_ids?: number[];
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  crate_weight?: number;
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
  bill_id?: number | null;
  applied_amount?: number;
  advance_amount?: number;
  balance_after?: number | null;
  created_by?: string;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
};

export type CustomerAccountSummary = {
  total_charged: number;
  total_paid: number;
  account_balance: number;
  outstanding_amount: number;
  advance_credit: number;
  unpaid_bills_count: number;
  oldest_bill_date: string | null;
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
  type: 'opening_balance' | 'bill' | 'payment';
  reference: string;
  debit?: number;
  credit?: number;
  balance: number;
  status?: string;
};
