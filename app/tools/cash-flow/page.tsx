'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getCustomers, type Customer } from '@/app/actions/stock';
import {
  getPaymentsByDate,
  addPayment,
  updatePayment,
  deletePayment,
  type Payment,
} from '@/app/actions/payments';
import {
  getExpensesByDate,
  addExpense,
  updateExpense,
  deleteExpense,
  type Expense,
  type ExpenseCategory,
} from '@/app/actions/expenses';

// Constants
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];
const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 1, name: 'Fuel/Transport', icon: 'truck', color: '#f59e0b' },
  { id: 2, name: 'Labor/Wages', icon: 'users', color: '#3b82f6' },
  { id: 3, name: 'Ice/Cold Storage', icon: 'snowflake', color: '#06b6d4' },
  { id: 4, name: 'Packaging', icon: 'package', color: '#8b5cf6' },
  { id: 5, name: 'Vehicle Maintenance', icon: 'wrench', color: '#ef4444' },
  { id: 6, name: 'Commission/Fees', icon: 'percent', color: '#10b981' },
  { id: 7, name: 'Food/Refreshments', icon: 'coffee', color: '#f97316' },
  { id: 8, name: 'Miscellaneous', icon: 'more', color: '#6b7280' },
];

// Icons
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

export default function CashFlowPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline form states - no modals, just expand in place
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Payment form
  const [paymentData, setPaymentData] = useState({
    customerId: '',
    receivedFrom: '',
    amount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
    notes: '',
  });

  // Expense form
  const [expenseData, setExpenseData] = useState({
    categoryId: '8',
    amount: '',
    description: '',
    paymentMethod: 'Cash',
    paidTo: '',
  });

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    const [customersData, paymentsData, expensesData] = await Promise.all([
      getCustomers(),
      getPaymentsByDate(date),
      getExpensesByDate(date),
    ]);
    setCustomers(customersData);
    setPayments(paymentsData);
    setExpenses(expensesData);
    setLoading(false);
  };

  // Payment handlers
  const resetPaymentForm = () => {
    setPaymentData({ customerId: '', receivedFrom: '', amount: '', paymentMethod: 'Cash', referenceNumber: '', notes: '' });
    setEditingPayment(null);
    setShowPaymentForm(false);
  };

  const handlePaymentSubmit = async () => {
    if (!paymentData.amount || (!paymentData.customerId && !paymentData.receivedFrom)) return;

    if (editingPayment) {
      const updated = await updatePayment(
        editingPayment.id,
        parseFloat(paymentData.amount),
        paymentData.paymentMethod,
        paymentData.customerId ? parseInt(paymentData.customerId) : undefined,
        paymentData.receivedFrom || undefined,
        paymentData.referenceNumber || undefined,
        paymentData.notes || undefined
      );
      if (updated) setPayments(payments.map(p => p.id === updated.id ? updated : p));
    } else {
      const newPayment = await addPayment(
        parseFloat(paymentData.amount),
        date,
        paymentData.paymentMethod,
        paymentData.customerId ? parseInt(paymentData.customerId) : undefined,
        paymentData.receivedFrom || undefined,
        paymentData.referenceNumber || undefined,
        paymentData.notes || undefined
      );
      if (newPayment) setPayments([newPayment, ...payments]);
    }
    resetPaymentForm();
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentData({
      customerId: payment.customer_id?.toString() || '',
      receivedFrom: (payment as any).received_from || '',
      amount: payment.amount.toString(),
      paymentMethod: payment.payment_method || 'Cash',
      referenceNumber: payment.reference_number || '',
      notes: payment.notes || '',
    });
    setShowPaymentForm(true);
  };

  const handleDeletePayment = async (id: number) => {
    if (!window.confirm('Delete this payment?')) return;
    const success = await deletePayment(id);
    if (success) setPayments(payments.filter(p => p.id !== id));
  };

  // Expense handlers
  const resetExpenseForm = () => {
    setExpenseData({ categoryId: '8', amount: '', description: '', paymentMethod: 'Cash', paidTo: '' });
    setEditingExpense(null);
    setShowExpenseForm(false);
  };

  const handleExpenseSubmit = async () => {
    if (!expenseData.amount || !expenseData.categoryId) return;

    if (editingExpense) {
      const updated = await updateExpense(
        editingExpense.id,
        parseInt(expenseData.categoryId),
        parseFloat(expenseData.amount),
        expenseData.description || undefined,
        expenseData.paymentMethod,
        expenseData.paidTo || undefined
      );
      if (updated) setExpenses(expenses.map(e => e.id === updated.id ? updated : e));
    } else {
      const newExpense = await addExpense(
        parseInt(expenseData.categoryId),
        parseFloat(expenseData.amount),
        date,
        expenseData.description || undefined,
        expenseData.paymentMethod,
        expenseData.paidTo || undefined
      );
      if (newExpense) setExpenses([newExpense, ...expenses]);
    }
    resetExpenseForm();
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseData({
      categoryId: expense.category_id.toString(),
      amount: expense.amount.toString(),
      description: expense.description || '',
      paymentMethod: expense.payment_method || 'Cash',
      paidTo: expense.paid_to || '',
    });
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Delete this expense?')) return;
    const success = await deleteExpense(id);
    if (success) setExpenses(expenses.filter(e => e.id !== id));
  };

  // Quick add handlers - single click to add
  const quickAddPayment = (customerId: number, customerName: string) => {
    setPaymentData({ ...paymentData, customerId: customerId.toString(), receivedFrom: '' });
    setShowPaymentForm(true);
  };

  const quickAddExpense = (categoryId: number) => {
    setExpenseData({ ...expenseData, categoryId: categoryId.toString() });
    setShowExpenseForm(true);
  };

  // Calculations
  const totalIn = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalOut = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netBalance = totalIn - totalOut;

  const getCategoryInfo = (categoryId: number) => {
    return EXPENSE_CATEGORIES.find(c => c.id === categoryId) || EXPENSE_CATEGORIES[7];
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ padding: '16px 20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header with Date and Net Balance */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          {/* Date Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() - 1);
                setDate(d.toISOString().split('T')[0]);
              }}
              style={{ padding: '8px 12px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px 0 0 6px', cursor: 'pointer', fontSize: '16px' }}
            >
              ‹
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', fontSize: '14px', fontWeight: 600 }}
            />
            <button
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() + 1);
                setDate(d.toISOString().split('T')[0]);
              }}
              style={{ padding: '8px 12px', background: 'white', border: '1px solid #d1d5db', borderRadius: '0 6px 6px 0', cursor: 'pointer', fontSize: '16px' }}
            >
              ›
            </button>
            <button
              onClick={() => setDate(new Date().toISOString().split('T')[0])}
              style={{ marginLeft: '4px', padding: '8px 14px', background: '#3b82f6', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Today
            </button>
          </div>

          {/* Summary Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#ecfdf5', borderRadius: '8px' }}>
              <ArrowDownIcon />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#059669' }}>₹{totalIn.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#fef2f2', borderRadius: '8px' }}>
              <ArrowUpIcon />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>₹{totalOut.toLocaleString()}</span>
            </div>
            <div
              style={{
                padding: '10px 18px',
                background: netBalance >= 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                borderRadius: '8px',
                color: 'white',
              }}
            >
              <span style={{ fontSize: '12px', opacity: 0.9 }}>Net: </span>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>₹{Math.abs(netBalance).toLocaleString()}</span>
              <span style={{ fontSize: '12px', opacity: 0.9 }}> {netBalance >= 0 ? 'profit' : 'loss'}</span>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* LEFT: Money In (Payments) */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #d1fae5', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', background: '#ecfdf5', borderBottom: '1px solid #d1fae5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', background: '#10b981', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <ArrowDownIcon />
                </div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#065f46' }}>Money In</span>
                <span style={{ fontSize: '13px', color: '#059669' }}>({payments.length})</span>
              </div>
              <button
                onClick={() => { resetPaymentForm(); setShowPaymentForm(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#10b981', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                <PlusIcon /> Add
              </button>
            </div>

            {/* Quick Add Customers */}
            {!showPaymentForm && customers.length > 0 && (
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0fdf4', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {customers.slice(0, 5).map(c => (
                  <button
                    key={c.id}
                    onClick={() => quickAddPayment(c.id, c.name)}
                    style={{ padding: '4px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', color: '#15803d', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    + {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Inline Add Form */}
            {showPaymentForm && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #d1fae5', background: '#f0fdf4' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <select
                    value={paymentData.customerId}
                    onChange={(e) => setPaymentData({ ...paymentData, customerId: e.target.value, receivedFrom: '' })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    placeholder="Amount ₹"
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
                {!paymentData.customerId && (
                  <input
                    type="text"
                    value={paymentData.receivedFrom}
                    onChange={(e) => setPaymentData({ ...paymentData, receivedFrom: e.target.value })}
                    placeholder="Or enter name"
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
                  />
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentData({ ...paymentData, paymentMethod: m })}
                      style={{ padding: '4px 10px', background: paymentData.paymentMethod === m ? '#10b981' : '#e5e7eb', border: 'none', borderRadius: '4px', color: paymentData.paymentMethod === m ? 'white' : '#374151', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {paymentData.paymentMethod !== 'Cash' && (
                  <input
                    type="text"
                    value={paymentData.referenceNumber}
                    onChange={(e) => setPaymentData({ ...paymentData, referenceNumber: e.target.value })}
                    placeholder="Reference #"
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
                  />
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handlePaymentSubmit}
                    style={{ flex: 1, padding: '8px', background: '#10b981', border: 'none', borderRadius: '4px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {editingPayment ? 'Update' : 'Save'}
                  </button>
                  <button
                    onClick={resetPaymentForm}
                    style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: '4px', color: '#374151', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Payments List */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {payments.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💰</div>
                  <div style={{ fontSize: '13px' }}>No payments yet</div>
                </div>
              ) : (
                payments.map(payment => (
                  <div
                    key={payment.id}
                    style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#059669' }}>₹{payment.amount.toLocaleString()}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', background: '#f3f4f6', borderRadius: '3px', color: '#6b7280' }}>{payment.payment_method}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{payment.customer_name || 'Unknown'}</div>
                    </div>
                    <button
                      onClick={() => handleEditPayment(payment)}
                      style={{ padding: '4px 8px', background: '#f3f4f6', border: 'none', borderRadius: '4px', color: '#6b7280', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      style={{ padding: '4px 6px', background: '#fef2f2', border: 'none', borderRadius: '4px', color: '#dc2626', cursor: 'pointer' }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: Money Out (Expenses) */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #fecaca', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', background: '#ef4444', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <ArrowUpIcon />
                </div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#991b1b' }}>Money Out</span>
                <span style={{ fontSize: '13px', color: '#dc2626' }}>({expenses.length})</span>
              </div>
              <button
                onClick={() => { resetExpenseForm(); setShowExpenseForm(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#ef4444', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                <PlusIcon /> Add
              </button>
            </div>

            {/* Quick Add Categories */}
            {!showExpenseForm && (
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #fef2f2', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {EXPENSE_CATEGORIES.slice(0, 5).map(c => (
                  <button
                    key={c.id}
                    onClick={() => quickAddExpense(c.id)}
                    style={{ padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', color: '#dc2626', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    + {c.name.split('/')[0]}
                  </button>
                ))}
              </div>
            )}

            {/* Inline Add Form */}
            {showExpenseForm && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #fecaca', background: '#fef2f2' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <select
                    value={expenseData.categoryId}
                    onChange={(e) => setExpenseData({ ...expenseData, categoryId: e.target.value })}
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                  >
                    {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input
                    type="number"
                    value={expenseData.amount}
                    onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                    placeholder="Amount ₹"
                    style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
                <input
                  type="text"
                  value={expenseData.paidTo}
                  onChange={(e) => setExpenseData({ ...expenseData, paidTo: e.target.value })}
                  placeholder="Paid to (optional)"
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  value={expenseData.description}
                  onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                  placeholder="Description (optional)"
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setExpenseData({ ...expenseData, paymentMethod: m })}
                      style={{ padding: '4px 10px', background: expenseData.paymentMethod === m ? '#ef4444' : '#e5e7eb', border: 'none', borderRadius: '4px', color: expenseData.paymentMethod === m ? 'white' : '#374151', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleExpenseSubmit}
                    style={{ flex: 1, padding: '8px', background: '#ef4444', border: 'none', borderRadius: '4px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {editingExpense ? 'Update' : 'Save'}
                  </button>
                  <button
                    onClick={resetExpenseForm}
                    style={{ padding: '8px 16px', background: '#e5e7eb', border: 'none', borderRadius: '4px', color: '#374151', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Expenses List */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {expenses.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📤</div>
                  <div style={{ fontSize: '13px' }}>No expenses yet</div>
                </div>
              ) : (
                expenses.map(expense => {
                  const category = getCategoryInfo(expense.category_id);
                  return (
                    <div
                      key={expense.id}
                      style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px' }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          background: `${category.color}15`,
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          color: category.color,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {category.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>₹{expense.amount.toLocaleString()}</span>
                          <span style={{ fontSize: '10px', padding: '2px 6px', background: `${category.color}15`, borderRadius: '3px', color: category.color }}>{category.name.split('/')[0]}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {expense.paid_to || expense.description || 'No description'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditExpense(expense)}
                        style={{ padding: '4px 8px', background: '#f3f4f6', border: 'none', borderRadius: '4px', color: '#6b7280', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        style={{ padding: '4px 6px', background: '#fef2f2', border: 'none', borderRadius: '4px', color: '#dc2626', cursor: 'pointer' }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
