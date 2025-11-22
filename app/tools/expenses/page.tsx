'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  getExpensesByDate,
  addExpense,
  updateExpense,
  deleteExpense,
  initializeExpenseCategories,
  addExpenseCategory,
  type Expense,
  type ExpenseCategory,
} from '@/app/actions/expenses';

// Icon components
function ExpenseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l-5 3Z" />
      <path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l-5 3Z" />
      <path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12" />
      <path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Credit'];

export default function ExpensesPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    description: '',
    paymentMethod: 'Cash',
    paidTo: '',
  });

  // New category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    const [categoriesData, expensesData] = await Promise.all([
      initializeExpenseCategories(),
      getExpensesByDate(date),
    ]);
    setCategories(categoriesData);
    setExpenses(expensesData);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      categoryId: '',
      amount: '',
      description: '',
      paymentMethod: 'Cash',
      paidTo: '',
    });
    setEditingExpense(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.amount) return;

    setSaving(true);
    try {
      if (editingExpense) {
        const updated = await updateExpense(
          editingExpense.id,
          parseInt(formData.categoryId),
          parseFloat(formData.amount),
          formData.description,
          formData.paymentMethod,
          formData.paidTo
        );
        if (updated) {
          setExpenses(expenses.map(e => e.id === updated.id ? updated : e));
        }
      } else {
        const newExpense = await addExpense(
          parseInt(formData.categoryId),
          parseFloat(formData.amount),
          date,
          formData.description,
          formData.paymentMethod,
          formData.paidTo
        );
        if (newExpense) {
          setExpenses([newExpense, ...expenses]);
        }
      }
      resetForm();
    } catch (err) {
      console.error('Error saving expense:', err);
      alert('Failed to save expense');
    }
    setSaving(false);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      categoryId: expense.category_id.toString(),
      amount: expense.amount.toString(),
      description: expense.description || '',
      paymentMethod: expense.payment_method || 'Cash',
      paidTo: expense.paid_to || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    const success = await deleteExpense(id);
    if (success) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    const newCategory = await addExpenseCategory(newCategoryName.trim());
    if (newCategory) {
      setCategories([...categories, newCategory]);
      setNewCategoryName('');
      setShowCategoryForm(false);
    }
  };

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const expensesByCategory = categories.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category_id === cat.id).reduce((sum, e) => sum + e.amount, 0),
    count: expenses.filter(e => e.category_id === cat.id).length,
  })).filter(cat => cat.total > 0).sort((a, b) => b.total - a.total);

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: '#f59e0b',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <ExpenseIcon />
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>Daily Expenses</h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Track and manage daily expenses</p>
              </div>
            </div>
            {saving && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#fef3c7', borderRadius: '20px' }}>
                <div style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>Saving...</span>
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Date</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => {
                  const d = new Date(date);
                  d.setDate(d.getDate() - 1);
                  setDate(d.toISOString().split('T')[0]);
                }}
                style={{
                  padding: '8px 12px',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRight: 'none',
                  borderRadius: '6px 0 0 6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                }}
              >
                ‹
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  color: '#374151',
                  fontWeight: 500,
                }}
              />
              <button
                onClick={() => {
                  const d = new Date(date);
                  d.setDate(d.getDate() + 1);
                  setDate(d.toISOString().split('T')[0]);
                }}
                style={{
                  padding: '8px 12px',
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderLeft: 'none',
                  borderRadius: '0 6px 6px 0',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#374151',
                }}
              >
                ›
              </button>
              <button
                onClick={() => setDate(new Date().toISOString().split('T')[0])}
                style={{
                  marginLeft: '8px',
                  padding: '8px 16px',
                  background: '#f59e0b',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* Total Card */}
          <div
            style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              borderRadius: '12px',
              color: 'white',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500, opacity: 0.9, marginBottom: '4px' }}>Total Expenses</div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>₹{totalExpenses.toLocaleString()}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>{expenses.length} transactions</div>
          </div>

          {/* Category breakdown */}
          {expensesByCategory.slice(0, 3).map(cat => (
            <div
              key={cat.id}
              style={{
                padding: '20px',
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                borderLeft: `4px solid ${cat.color || '#6b7280'}`,
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>{cat.name}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>₹{cat.total.toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{cat.count} items</div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
          {/* Expenses List */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>Expenses List</h2>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: '#f59e0b',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PlusIcon />
                Add Expense
              </button>
            </div>

            {expenses.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📝</div>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>No expenses recorded</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Add your first expense for this day</div>
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '40px',
                        background: expense.category_color || '#6b7280',
                        borderRadius: '4px',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                          ₹{expense.amount.toLocaleString()}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: expense.category_color || '#6b7280',
                            background: `${expense.category_color}15` || '#6b728015',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {expense.category_name}
                        </span>
                        {expense.payment_method && (
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>• {expense.payment_method}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        {expense.description || 'No description'}
                        {expense.paid_to && <span style={{ color: '#9ca3af' }}> — Paid to: {expense.paid_to}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEdit(expense)}
                        style={{
                          padding: '6px 10px',
                          background: '#f3f4f6',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#374151',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                        }}
                      >
                        <EditIcon /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        style={{
                          padding: '6px 10px',
                          background: '#fef2f2',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#dc2626',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                        }}
                      >
                        <TrashIcon /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add/Edit Form & Category Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Add/Edit Form */}
            {showForm && (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0' }}>
                  {editingExpense ? 'Edit Expense' : 'Add New Expense'}
                </h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Category */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Category *
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        required
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          background: 'white',
                        }}
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCategoryForm(!showCategoryForm)}
                        style={{
                          padding: '10px',
                          background: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#374151',
                        }}
                        title="Add new category"
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  </div>

                  {/* New Category Form */}
                  {showCategoryForm && (
                    <div style={{ display: 'flex', gap: '8px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                      <input
                        type="text"
                        placeholder="New category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '13px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        style={{
                          padding: '8px 12px',
                          background: '#10b981',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="What was this expense for?"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Payment Method
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: 'white',
                        boxSizing: 'border-box',
                      }}
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>

                  {/* Paid To */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Paid To
                    </label>
                    <input
                      type="text"
                      value={formData.paidTo}
                      onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                      placeholder="Person or vendor name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        background: '#f59e0b',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Add Expense'}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      style={{
                        padding: '10px 16px',
                        background: '#f3f4f6',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#374151',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Category Breakdown */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0' }}>
                Category Breakdown
              </h3>
              {expensesByCategory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>
                  No expenses recorded yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {expensesByCategory.map((cat) => {
                    const percentage = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                    return (
                      <div key={cat.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{cat.name}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>₹{cat.total.toLocaleString()}</span>
                        </div>
                        <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${percentage}%`,
                              background: cat.color || '#6b7280',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                          {percentage.toFixed(1)}% of total
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Add Buttons */}
            {!showForm && (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 12px 0' }}>
                  Quick Add
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {categories.slice(0, 6).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setFormData({ ...formData, categoryId: cat.id.toString() });
                        setShowForm(true);
                      }}
                      style={{
                        padding: '8px 14px',
                        background: `${cat.color}15` || '#6b728015',
                        border: `1px solid ${cat.color}40` || '#6b728040',
                        borderRadius: '6px',
                        color: cat.color || '#6b7280',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      + {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
