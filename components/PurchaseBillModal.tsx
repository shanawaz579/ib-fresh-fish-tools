'use client';

import { useState, useEffect } from 'react';
import { createPurchaseBill, getLastPurchaseRateForVariety, type PurchaseBillDeduction } from '@/app/actions/purchaseBills';

type BillItem = {
  varietyId: number;
  varietyName: string;
  crates: number;
  crateWeight: number;
  totalWeight: number;
  applyDeduction: boolean;
  deductionPercent: number;
  billableWeight: number;
  rate: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  farmer: { id: number; name: string } | null;
  purchases: any[];
  date: string;
  crateWeight?: number;
  onBillCreated?: () => void;
};

export default function PurchaseBillModal({
  isOpen,
  onClose,
  farmer,
  purchases,
  date,
  crateWeight = 35,
  onBillCreated,
}: Props) {
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [commissionPerKg, setCommissionPerKg] = useState('0.5');
  const [otherDeductions, setOtherDeductions] = useState<PurchaseBillDeduction[]>([]);
  const [deductionName, setDeductionName] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'neft' | 'other'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && purchases.length > 0) {
      loadPurchaseItems();
    }
  }, [isOpen, purchases]);

  const loadPurchaseItems = async () => {
    // Group by variety
    const grouped: { [key: number]: any } = {};

    for (const purchase of purchases) {
      const varietyId = purchase.varietyId;

      if (!grouped[varietyId]) {
        grouped[varietyId] = {
          varietyId,
          varietyName: purchase.varietyName,
          crates: purchase.crates || 0,
          kg: purchase.kg || 0,
        };
      } else {
        grouped[varietyId].crates += purchase.crates || 0;
        grouped[varietyId].kg += purchase.kg || 0;
      }
    }

    const items: BillItem[] = [];
    for (const item of Object.values(grouped)) {
      const lastRate = await getLastPurchaseRateForVariety(item.varietyId);
      // Total weight = (crates × crate weight) + loose kg
      const totalWeight = (item.crates * crateWeight) + item.kg;
      const applyDeduction = true; // Default ON
      const deduction = 5;
      const billableWeight = applyDeduction ? totalWeight * (1 - deduction / 100) : totalWeight;

      items.push({
        varietyId: item.varietyId,
        varietyName: item.varietyName,
        crates: item.crates,
        crateWeight: crateWeight,
        totalWeight,
        applyDeduction,
        deductionPercent: deduction,
        billableWeight,
        rate: lastRate || 0,
      });
    }

    setBillItems(items);
  };

  const handleAddDeduction = () => {
    if (!deductionName || !deductionAmount) return;
    setOtherDeductions([...otherDeductions, { name: deductionName, amount: parseFloat(deductionAmount) }]);
    setDeductionName('');
    setDeductionAmount('');
  };

  const handleRemoveDeduction = (index: number) => {
    setOtherDeductions(otherDeductions.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof BillItem, value: number | boolean) => {
    const updated = [...billItems];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate based on changes
    const item = updated[index];
    const totalWeight = item.crates * item.crateWeight;
    const billableWeight = item.applyDeduction
      ? totalWeight * (1 - item.deductionPercent / 100)
      : totalWeight;

    updated[index] = {
      ...item,
      totalWeight,
      billableWeight,
    };

    setBillItems(updated);
  };

  const calculateTotals = () => {
    const grossAmount = billItems.reduce((sum, item) => sum + item.totalWeight * item.rate, 0);
    const weightDeductionAmount = billItems.reduce((sum, item) => sum + (item.totalWeight - item.billableWeight) * item.rate, 0);
    const subtotal = billItems.reduce((sum, item) => sum + item.billableWeight * item.rate, 0);

    // Commission = ₹0.5 per kg of total billable weight (ADDED to bill)
    const totalBillableWeight = billItems.reduce((sum, item) => sum + item.billableWeight, 0);
    const commissionAmount = totalBillableWeight * (parseFloat(commissionPerKg) || 0);

    const otherDeductionsTotal = otherDeductions.reduce((sum, d) => sum + d.amount, 0);
    const total = subtotal + commissionAmount - otherDeductionsTotal; // Commission is ADDED
    const paid = parseFloat(amountPaid) || 0;
    const balance = total - paid;

    return {
      grossAmount,
      weightDeductionAmount,
      subtotal,
      totalBillableWeight,
      commissionAmount,
      otherDeductionsTotal,
      total,
      paid,
      balance,
    };
  };

  const totals = calculateTotals();

  const handleSubmit = async () => {
    if (!farmer || billItems.length === 0) {
      alert('No items to bill');
      return;
    }

    // Check if all items have rates
    const missingRates = billItems.filter(item => !item.rate || item.rate === 0);
    if (missingRates.length > 0) {
      alert(`Missing rates for: ${missingRates.map(i => i.varietyName).join(', ')}`);
      return;
    }

    setSubmitting(true);

    const items = billItems.map(item => ({
      fish_variety_id: item.varietyId,
      fish_variety_name: item.varietyName,
      quantity_crates: item.crates,
      quantity_kg: 0, // No loose kg in this simplified version
      actual_weight: item.totalWeight,
      billable_weight: item.billableWeight,
      rate_per_kg: item.rate,
    }));

    const initialPayment = parseFloat(amountPaid) > 0 ? {
      amount: parseFloat(amountPaid),
      payment_date: paymentDate,
      payment_mode: paymentMode,
      notes: paymentNotes || undefined,
    } : undefined;

    const result = await createPurchaseBill(
      farmer.id,
      date,
      items,
      parseFloat(commissionPerKg) || 0,
      5, // Fixed 5% deduction
      otherDeductions,
      notes || undefined,
      initialPayment
    );

    setSubmitting(false);

    if (result) {
      alert('Purchase bill created successfully!');
      onBillCreated?.();
      onClose();
    } else {
      alert('Failed to create purchase bill');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-orange-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Create Purchase Bill</h2>
            <p className="text-sm opacity-90">{farmer?.name}</p>
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
        <div className="p-6 space-y-4">
          {/* Bill Items */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Purchase Items</h3>
            <div className="space-y-3">
              {billItems.map((item, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-medium text-gray-800">{item.varietyName}</div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.applyDeduction}
                        onChange={(e) => updateItem(index, 'applyDeduction', e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded"
                      />
                      <span className="text-gray-600">Apply 5% deduction</span>
                    </label>
                  </div>

                  {/* Calculation Display */}
                  <div className="flex items-center gap-2 text-sm mb-3 flex-wrap">
                    <input
                      type="number"
                      value={item.crates}
                      onChange={(e) => updateItem(index, 'crates', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border rounded text-center font-medium"
                      min="0"
                    />
                    <span>×</span>
                    <input
                      type="number"
                      value={item.crateWeight}
                      onChange={(e) => updateItem(index, 'crateWeight', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border rounded text-center"
                      min="0"
                      step="0.1"
                    />
                    <span>=</span>
                    <span className="font-medium">{item.totalWeight.toFixed(0)}</span>

                    {item.applyDeduction && (
                      <>
                        <span>-</span>
                        <span className="text-red-600">{(item.totalWeight - item.billableWeight).toFixed(0)}</span>
                        <span className="text-gray-400 text-xs">({item.deductionPercent}%)</span>
                      </>
                    )}

                    <span className="font-medium">{item.billableWeight.toFixed(0)}</span>
                    <span>×</span>
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded text-center"
                      min="0"
                      step="0.1"
                    />
                    <span>=</span>
                    <span className="font-bold text-green-600">₹{(item.billableWeight * item.rate).toFixed(0)}</span>
                  </div>

                  {/* Helper text */}
                  <div className="text-xs text-gray-500">
                    {item.crates} crates × {item.crateWeight}kg = {item.totalWeight}kg
                    {item.applyDeduction && ` - ${item.deductionPercent}% = ${item.billableWeight.toFixed(2)}kg`}
                    {!item.applyDeduction && ` = ${item.billableWeight.toFixed(2)}kg`}
                    {' '}× ₹{item.rate}/kg = ₹{(item.billableWeight * item.rate).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commission */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Commission (₹ per kg)
            </label>
            <input
              type="number"
              value={commissionPerKg}
              onChange={(e) => setCommissionPerKg(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              step="0.1"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              {totals.totalBillableWeight.toFixed(2)} kg × ₹{commissionPerKg} = ₹{totals.commissionAmount.toFixed(2)}
            </p>
          </div>

          {/* Initial Payment */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-800 mb-3">Initial Payment (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  step="0.01"
                  min="0"
                  placeholder="0"
                />
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
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          {/* Other Deductions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Deductions
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Name (Ice, Transport, etc.)"
                value={deductionName}
                onChange={(e) => setDeductionName(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="number"
                placeholder="Amount"
                value={deductionAmount}
                onChange={(e) => setDeductionAmount(e.target.value)}
                className="w-32 px-3 py-2 border rounded-lg text-sm"
                step="0.01"
                min="0"
              />
              <button
                onClick={handleAddDeduction}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                Add
              </button>
            </div>
            {otherDeductions.length > 0 && (
              <div className="space-y-1">
                {otherDeductions.map((d, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded text-sm">
                    <span>{d.name}</span>
                    <div className="flex items-center gap-2">
                      <span>₹{d.amount.toFixed(2)}</span>
                      <button
                        onClick={() => handleRemoveDeduction(i)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* Calculation Summary */}
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 space-y-2">
            <div className="flex justify-between font-semibold text-lg">
              <span>Subtotal:</span>
              <span>₹{totals.subtotal.toFixed(0)}</span>
            </div>
            {totals.commissionAmount > 0 && (
              <div className="flex justify-between text-orange-600 font-medium">
                <span>Commission ({totals.totalBillableWeight.toFixed(0)}kg × ₹{commissionPerKg}):</span>
                <span>+₹{totals.commissionAmount.toFixed(0)}</span>
              </div>
            )}
            {totals.otherDeductionsTotal > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Other Deductions:</span>
                <span>-₹{totals.otherDeductionsTotal.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl border-t-2 border-orange-400 pt-2">
              <span>Total:</span>
              <span>₹{totals.total.toFixed(0)}</span>
            </div>
            {totals.paid > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Paid:</span>
                <span>-₹{totals.paid.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-orange-700 text-lg border-t border-orange-300 pt-2">
              <span>Balance Due:</span>
              <span>₹{totals.balance.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-xl border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Bill'}
          </button>
        </div>
      </div>
    </div>
  );
}
