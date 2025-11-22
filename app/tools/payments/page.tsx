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

// Payment methods - defined locally since server actions can only export functions
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

// Icon components
function PaymentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
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

// Payment method colors
const METHOD_COLORS: { [key: string]: string } = {
  'Cash': '#10b981',
  'UPI': '#8b5cf6',
  'Bank Transfer': '#3b82f6',
  'Cheque': '#f59e0b',
  'Card': '#ec4899',
};

export default function PaymentsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    receivedFrom: '',
    amount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    const [customersData, paymentsData] = await Promise.all([
      getCustomers(),
      getPaymentsByDate(date),
    ]);
    setCustomers(customersData);
    setPayments(paymentsData);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      receivedFrom: '',
      amount: '',
      paymentMethod: 'Cash',
      referenceNumber: '',
      notes: '',
    });
    setEditingPayment(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || (!formData.customerId && !formData.receivedFrom)) return;

    setSaving(true);
    try {
      if (editingPayment) {
        const updated = await updatePayment(
          editingPayment.id,
          parseFloat(formData.amount),
          formData.paymentMethod,
          formData.customerId ? parseInt(formData.customerId) : undefined,
          formData.receivedFrom || undefined,
          formData.referenceNumber || undefined,
          formData.notes || undefined
        );
        if (updated) {
          setPayments(payments.map(p => p.id === updated.id ? updated : p));
        }
      } else {
        const newPayment = await addPayment(
          parseFloat(formData.amount),
          date,
          formData.paymentMethod,
          formData.customerId ? parseInt(formData.customerId) : undefined,
          formData.receivedFrom || undefined,
          formData.referenceNumber || undefined,
          formData.notes || undefined
        );
        if (newPayment) {
          setPayments([newPayment, ...payments]);
        }
      }
      resetForm();
    } catch (err) {
      console.error('Error saving payment:', err);
      alert('Failed to save payment');
    }
    setSaving(false);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      customerId: payment.customer_id?.toString() || '',
      receivedFrom: (payment as any).received_from || '',
      amount: payment.amount.toString(),
      paymentMethod: payment.payment_method || 'Cash',
      referenceNumber: payment.reference_number || '',
      notes: payment.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this payment record?')) return;

    const success = await deletePayment(id);
    if (success) {
      setPayments(payments.filter(p => p.id !== id));
    }
  };

  // Calculate totals
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const paymentsByMethod = PAYMENT_METHODS.map(method => ({
    method,
    total: payments.filter(p => p.payment_method === method).reduce((sum, p) => sum + p.amount, 0),
    count: payments.filter(p => p.payment_method === method).length,
    color: METHOD_COLORS[method] || '#6b7280',
  })).filter(m => m.total > 0);

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
                  background: '#10b981',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <PaymentIcon />
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>Payments Received</h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Track daily collections from customers</p>
              </div>
            </div>
            {saving && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#d1fae5', borderRadius: '20px' }}>
                <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: '13px', color: '#065f46', fontWeight: 500 }}>Saving...</span>
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
                  background: '#10b981',
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* Total Card */}
          <div
            style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '12px',
              color: 'white',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500, opacity: 0.9, marginBottom: '4px' }}>Total Received</div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>₹{totalPayments.toLocaleString()}</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>{payments.length} transactions</div>
          </div>

          {/* Payment method breakdown */}
          {paymentsByMethod.map(item => (
            <div
              key={item.method}
              style={{
                padding: '20px',
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                borderLeft: `4px solid ${item.color}`,
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>{item.method}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>₹{item.total.toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{item.count} payments</div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
          {/* Payments List */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>Payment Records</h2>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PlusIcon />
                Add Payment
              </button>
            </div>

            {payments.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>No payments recorded</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Add your first payment for this day</div>
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {payments.map((payment) => (
                  <div
                    key={payment.id}
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
                        width: '44px',
                        height: '44px',
                        background: `${METHOD_COLORS[payment.payment_method] || '#6b7280'}15`,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: METHOD_COLORS[payment.payment_method] || '#6b7280',
                        fontWeight: 700,
                        fontSize: '14px',
                        flexShrink: 0,
                      }}
                    >
                      {payment.payment_method === 'Cash' ? '₹' : payment.payment_method.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>
                          ₹{payment.amount.toLocaleString()}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: METHOD_COLORS[payment.payment_method] || '#6b7280',
                            background: `${METHOD_COLORS[payment.payment_method] || '#6b7280'}15`,
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {payment.payment_method}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                        {payment.customer_name || 'Unknown'}
                      </div>
                      {(payment.reference_number || payment.notes) && (
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                          {payment.reference_number && <span>Ref: {payment.reference_number}</span>}
                          {payment.reference_number && payment.notes && <span> • </span>}
                          {payment.notes && <span>{payment.notes}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEdit(payment)}
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
                        onClick={() => handleDelete(payment.id)}
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

          {/* Add/Edit Form & Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Add/Edit Form */}
            {showForm && (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0' }}>
                  {editingPayment ? 'Edit Payment' : 'Record New Payment'}
                </h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Customer Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Customer
                    </label>
                    <select
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value, receivedFrom: '' })}
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
                      <option value="">Select customer or enter name below</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Or enter name */}
                  {!formData.customerId && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Or Enter Name *
                      </label>
                      <input
                        type="text"
                        value={formData.receivedFrom}
                        onChange={(e) => setFormData({ ...formData, receivedFrom: e.target.value })}
                        placeholder="Name of person"
                        required={!formData.customerId}
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

                  {/* Payment Method */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Payment Method
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {PAYMENT_METHODS.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setFormData({ ...formData, paymentMethod: method })}
                          style={{
                            padding: '8px 14px',
                            background: formData.paymentMethod === method ? METHOD_COLORS[method] : '#f3f4f6',
                            border: 'none',
                            borderRadius: '6px',
                            color: formData.paymentMethod === method ? 'white' : '#374151',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference Number */}
                  {formData.paymentMethod !== 'Cash' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                        Reference Number
                      </label>
                      <input
                        type="text"
                        value={formData.referenceNumber}
                        onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                        placeholder={formData.paymentMethod === 'UPI' ? 'UPI Transaction ID' : formData.paymentMethod === 'Cheque' ? 'Cheque Number' : 'Transaction Reference'}
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
                  )}

                  {/* Notes */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Notes
                    </label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes (optional)"
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
                        background: '#10b981',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? 'Saving...' : editingPayment ? 'Update Payment' : 'Record Payment'}
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

            {/* Payment Method Breakdown */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0' }}>
                Payment Methods
              </h3>
              {paymentsByMethod.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>
                  No payments recorded yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {paymentsByMethod.map((item) => {
                    const percentage = totalPayments > 0 ? (item.total / totalPayments) * 100 : 0;
                    return (
                      <div key={item.method}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{item.method}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>₹{item.total.toLocaleString()}</span>
                        </div>
                        <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${percentage}%`,
                              background: item.color,
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                          {item.count} payment{item.count !== 1 ? 's' : ''} • {percentage.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Add for common amounts */}
            {!showForm && (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 12px 0' }}>
                  Quick Add
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {customers.slice(0, 6).map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setFormData({ ...formData, customerId: customer.id.toString() });
                        setShowForm(true);
                      }}
                      style={{
                        padding: '8px 14px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        color: '#15803d',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      + {customer.name}
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
