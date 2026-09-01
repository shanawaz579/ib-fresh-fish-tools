export type PurchaseBillLine = {
  id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  actual_weight: number;
  billable_weight: number;
  rate_per_kg: number;
  amount: number;
};

export type PurchaseBillPaymentRecord = {
  id: number;
  payment_date: string;
  amount: number;
  payment_mode: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
};

export type PurchaseBillDeduction = {
  type: string;
  amount: number;
};

export type PurchaseBillDetails = {
  id: number;
  bill_number: string;
  supplier_id: number;
  supplier_name: string;
  bill_date: string;
  gross_amount: number;
  weight_deduction_percentage: number;
  weight_deduction_amount: number;
  subtotal: number;
  commission_per_kg: number;
  commission_amount: number;
  other_deductions: PurchaseBillDeduction[];
  other_deductions_total: number;
  total: number;
  payment_status: string;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  location?: string;
  secondary_name?: string;
  items: PurchaseBillLine[];
  payments: PurchaseBillPaymentRecord[];
};
