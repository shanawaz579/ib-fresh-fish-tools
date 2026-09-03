import supabase from '../lib/supabase';
import type { PaymentRegisterEntry, RegisterPaymentMethod } from '../domain/paymentRegister';

type RelatedRow = { id?: number; name?: string; bill_number?: string } | Array<{ id?: number; name?: string; bill_number?: string }> | null;

function firstRelation(value: RelatedRow) {
  return Array.isArray(value) ? value[0] : value;
}

export async function getPaymentRegister(date: string): Promise<PaymentRegisterEntry[]> {
  const [receiptsResult, supplierPaymentsResult] = await Promise.all([
    supabase
      .from('payments')
      .select('id, customer_id, bill_id, payment_date, amount, payment_method, reference_number, notes, created_at, voided_at, void_reason, customers(id, name), bills(id, bill_number)')
      .eq('payment_date', date)
      .order('created_at', { ascending: false }),
    supabase
      .from('purchase_bill_payments')
      .select('id, supplier_id, purchase_bill_id, bill_number_snapshot, payment_date, amount, payment_mode, reference_number, notes, created_at, voided_at, void_reason, suppliers(id, name), purchase_bills(id, bill_number)')
      .eq('payment_date', date)
      .order('created_at', { ascending: false }),
  ]);

  if (receiptsResult.error) throw receiptsResult.error;
  if (supplierPaymentsResult.error) throw supplierPaymentsResult.error;

  const receipts: PaymentRegisterEntry[] = (receiptsResult.data ?? []).map((row: any) => {
    const customer = firstRelation(row.customers);
    const bill = firstRelation(row.bills);
    return {
      key: `received-${row.id}`,
      sourceId: row.id,
      direction: 'received',
      paymentDate: row.payment_date,
      amount: Number(row.amount),
      method: row.payment_method as RegisterPaymentMethod,
      partyId: row.customer_id,
      partyName: customer?.name ?? 'Unknown customer',
      billId: row.bill_id ?? null,
      billNumber: bill?.bill_number ?? null,
      referenceNumber: row.reference_number ?? null,
      notes: row.notes ?? null,
      createdAt: row.created_at,
      voidedAt: row.voided_at ?? null,
      voidReason: row.void_reason ?? null,
    };
  });

  const supplierPayments: PaymentRegisterEntry[] = (supplierPaymentsResult.data ?? []).map((row: any) => {
    const supplier = firstRelation(row.suppliers);
    const bill = firstRelation(row.purchase_bills);
    return {
      key: `paid-${row.id}`,
      sourceId: row.id,
      direction: 'paid',
      paymentDate: row.payment_date,
      amount: Number(row.amount),
      method: row.payment_mode as RegisterPaymentMethod,
      partyId: row.supplier_id,
      partyName: supplier?.name ?? 'Unknown supplier',
      billId: row.purchase_bill_id ?? null,
      billNumber: bill?.bill_number ?? row.bill_number_snapshot ?? null,
      referenceNumber: row.reference_number ?? null,
      notes: row.notes ?? null,
      createdAt: row.created_at,
      voidedAt: row.voided_at ?? null,
      voidReason: row.void_reason ?? null,
    };
  });

  return [...receipts, ...supplierPayments].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt) || b.sourceId - a.sourceId,
  );
}
