'use client';

import { useState, useEffect } from 'react';
import {
  getPurchaseBillById,
  addPaymentToPurchaseBill,
  type PurchaseBill,
  type PurchaseBillPayment,
} from '@/app/actions/purchaseBills';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  billId: number | null;
  onPaymentAdded?: () => void;
};

export default function PurchaseBillDetailModal({
  isOpen,
  onClose,
  billId,
  onPaymentAdded,
}: Props) {
  const [bill, setBill] = useState<PurchaseBill | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'neft' | 'other'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && billId) {
      loadBill();
    }
  }, [isOpen, billId]);

  const loadBill = async () => {
    if (!billId) return;

    setLoading(true);
    const data = await getPurchaseBillById(billId);
    setBill(data);
    setLoading(false);
  };

  const handleAddPayment = async () => {
    if (!billId || !bill) return;

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (amount > bill.balance_due) {
      if (!confirm(`Payment amount (₹${amount}) exceeds balance due (₹${bill.balance_due.toFixed(2)}). Continue?`)) {
        return;
      }
    }

    setSubmitting(true);

    const success = await addPaymentToPurchaseBill(billId, {
      payment_date: paymentDate,
      amount,
      payment_mode: paymentMode,
      notes: paymentNotes || undefined,
    });

    setSubmitting(false);

    if (success) {
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('cash');
      setPaymentNotes('');
      setShowAddPayment(false);
      await loadBill();
      onPaymentAdded?.();
    } else {
      alert('Failed to add payment');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPaymentModeLabel = (mode: string) => {
    switch (mode) {
      case 'cash': return 'Cash';
      case 'upi': return 'UPI';
      case 'neft': return 'NEFT';
      case 'other': return 'Other';
      default: return mode;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-amber-100 text-amber-700';
      default: return 'bg-red-100 text-red-700';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-orange-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Purchase Bill Details</h2>
            {bill && <p className="text-sm opacity-90">{bill.bill_number} - {bill.farmer_name}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-orange-600 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : !bill ? (
          <div className="p-8 text-center text-gray-500">Bill not found</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Bill Summary */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-sm text-gray-600">Date</div>
                  <div className="font-semibold">{formatDate(bill.bill_date)}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(bill.payment_status)}`}>
                  {bill.payment_status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Gross Amount</div>
                  <div className="font-semibold text-lg">₹{bill.gross_amount.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Total Amount</div>
                  <div className="font-semibold text-lg text-orange-600">₹{bill.total.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Balance Due</div>
                  <div className="font-semibold text-lg text-red-600">₹{bill.balance_due.toFixed(0)}</div>
                </div>
              </div>
            </div>

            {/* Bill Items */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Items</h3>
              <div className="space-y-2">
                {bill.items.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="font-medium text-gray-800 mb-2">{item.fish_variety_name}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <div>Quantity: {item.quantity_crates} crates, {item.quantity_kg.toFixed(2)} kg</div>
                      <div>Rate: ₹{item.rate_per_kg}/kg</div>
                      <div>Actual Weight: {item.actual_weight.toFixed(2)} kg</div>
                      <div className="text-orange-600 font-medium">
                        Billable Weight: {item.billable_weight.toFixed(2)} kg
                      </div>
                      <div className="col-span-2 font-semibold text-gray-800 border-t pt-1 mt-1">
                        Amount: ₹{item.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Gross Amount:</span>
                <span>₹{bill.gross_amount.toFixed(0)}</span>
              </div>
              {bill.weight_deduction_amount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Weight Deduction ({bill.weight_deduction_percentage}%):</span>
                  <span>-₹{bill.weight_deduction_amount.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium border-t border-orange-300 pt-2">
                <span>Subtotal:</span>
                <span>₹{bill.subtotal.toFixed(0)}</span>
              </div>
              {bill.commission_amount > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Commission (₹{bill.commission_per_kg}/kg):</span>
                  <span>+₹{bill.commission_amount.toFixed(0)}</span>
                </div>
              )}
              {bill.other_deductions_total > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Other Deductions:</span>
                  <span>-₹{bill.other_deductions_total.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t-2 border-orange-400 pt-2">
                <span>Total:</span>
                <span>₹{bill.total.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-green-600 font-medium">
                <span>Amount Paid:</span>
                <span>₹{bill.amount_paid.toFixed(0)}</span>
              </div>
              <div className="flex justify-between font-bold text-red-600 text-lg border-t border-orange-300 pt-2">
                <span>Balance Due:</span>
                <span>₹{bill.balance_due.toFixed(0)}</span>
              </div>
            </div>

            {/* Payment History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Payment History</h3>
                {bill.balance_due > 0 && (
                  <button
                    onClick={() => setShowAddPayment(!showAddPayment)}
                    className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 font-medium"
                  >
                    {showAddPayment ? 'Cancel' : '+ Add Payment'}
                  </button>
                )}
              </div>

              {/* Add Payment Form */}
              {showAddPayment && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-3">
                  <h4 className="font-medium text-gray-800 mb-3">Add New Payment</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">Balance due: ₹{bill.balance_due.toFixed(2)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value as 'cash' | 'upi' | 'neft' | 'other')}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="neft">NEFT</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                      <input
                        type="text"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Payment notes"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddPayment}
                    disabled={submitting}
                    className="w-full mt-3 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold disabled:opacity-50"
                  >
                    {submitting ? 'Adding Payment...' : 'Add Payment'}
                  </button>
                </div>
              )}

              {/* Payments List */}
              {bill.payments && bill.payments.length > 0 ? (
                <div className="space-y-2">
                  {bill.payments.map((payment, idx) => (
                    <div key={payment.id || idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold text-gray-800">₹{payment.amount.toFixed(2)}</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            {getPaymentModeLabel(payment.payment_mode)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {formatDate(payment.payment_date)}
                          {payment.notes && <span className="ml-2">• {payment.notes}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
                  No payments recorded yet
                </div>
              )}
            </div>

            {bill.notes && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-1">Notes</div>
                <div className="text-sm text-gray-600">{bill.notes}</div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-xl border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
