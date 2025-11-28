'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getFarmers, getFishVarieties, getPurchasesByDate } from '@/app/actions/stock';
import {
  getPurchasesForBilling,
  createPurchaseBill,
  getPurchaseBillsByDate,
  deletePurchaseBill,
  getLastPurchaseRateForVariety,
  type PurchaseBill,
  type PurchaseBillItem,
} from '@/app/actions/purchaseBills';
import type { Farmer, FishVariety } from '@/app/actions/stock';
import SearchableSelect from '@/components/SearchableSelect';
import { ProtectedRoute } from '@/components/ProtectedRoute';

type BillItemForm = {
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  actual_weight: number;
  rate_per_kg: number;
};

export default function PurchaseBillsPage() {
  const searchParams = useSearchParams();
  const urlDate = searchParams.get('date');
  const urlFarmerId = searchParams.get('farmerId');

  const [date, setDate] = useState(urlDate || new Date().toISOString().split('T')[0]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);

  // Form state
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [billItems, setBillItems] = useState<BillItemForm[]>([]);
  const [commissionPercentage, setCommissionPercentage] = useState('0');
  const [weightDeductionPercentage, setWeightDeductionPercentage] = useState('5');
  const [applyWeightDeduction, setApplyWeightDeduction] = useState(true);
  const [otherDeductions, setOtherDeductions] = useState<{ name: string; amount: number }[]>([]);
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Other deduction form
  const [deductionName, setDeductionName] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');

  // Item form
  const [itemFishVarietyId, setItemFishVarietyId] = useState('');
  const [itemKg, setItemKg] = useState('');
  const [itemRate, setItemRate] = useState('');
  const [showManualRate, setShowManualRate] = useState(false);
  const [crateWeight, setCrateWeight] = useState('35'); // Default crate weight

  useEffect(() => {
    loadData();
  }, [date]);

  // Auto-load purchases when URL parameters are present
  useEffect(() => {
    const autoLoadPurchases = async () => {
      if (urlFarmerId && farmers.length > 0 && varieties.length > 0) {
        setSelectedFarmerId(urlFarmerId);

        const farmerPurchases = purchases.filter(
          (p) => p.farmer_id === parseInt(urlFarmerId)
        );

        // Group by variety and sum quantities
        const grouped: { [key: number]: BillItemForm } = {};

        for (const purchase of farmerPurchases) {
          const varietyId = purchase.fish_variety_id;

          if (!grouped[varietyId]) {
            // Get last rate for this variety
            const lastRate = await getLastPurchaseRateForVariety(varietyId);

            grouped[varietyId] = {
              fish_variety_id: varietyId,
              fish_variety_name: purchase.fish_variety_name,
              quantity_crates: 0,
              quantity_kg: 0,
              actual_weight: 0,
              rate_per_kg: lastRate || 0,
            };
          }

          grouped[varietyId].quantity_crates += purchase.quantity_crates;
          grouped[varietyId].quantity_kg += purchase.quantity_kg;
          grouped[varietyId].actual_weight += purchase.quantity_kg;
        }

        setBillItems(Object.values(grouped));
      }
    };

    autoLoadPurchases();
  }, [urlFarmerId, farmers, varieties, purchases]);

  const loadData = async () => {
    setLoading(true);
    const [farmersData, varietiesData, purchasesData, billsData] = await Promise.all([
      getFarmers(),
      getFishVarieties(),
      getPurchasesForBilling(date),
      getPurchaseBillsByDate(date),
    ]);
    setFarmers(farmersData);
    setVarieties(varietiesData);
    setPurchases(purchasesData);
    setBills(billsData);
    setLoading(false);
  };

  const handleLoadPurchasesForFarmer = async () => {
    if (!selectedFarmerId) return;

    const farmerPurchases = purchases.filter(
      (p) => p.farmer_id === parseInt(selectedFarmerId)
    );

    // Group by variety and sum quantities
    const grouped: { [key: number]: BillItemForm } = {};

    for (const purchase of farmerPurchases) {
      const varietyId = purchase.fish_variety_id;

      if (!grouped[varietyId]) {
        // Get last rate for this variety
        const lastRate = await getLastPurchaseRateForVariety(varietyId);

        grouped[varietyId] = {
          fish_variety_id: varietyId,
          fish_variety_name: purchase.fish_variety_name,
          quantity_crates: 0,
          quantity_kg: 0,
          actual_weight: 0,
          rate_per_kg: lastRate || 0,
        };
      }

      grouped[varietyId].quantity_crates += purchase.quantity_crates;
      grouped[varietyId].quantity_kg += purchase.quantity_kg;
      grouped[varietyId].actual_weight += purchase.quantity_kg;
    }

    setBillItems(Object.values(grouped));
  };

  const handleAddItem = async () => {
    if (!itemFishVarietyId || !itemKg) {
      alert('Please select fish variety and enter weight in kg');
      return;
    }

    const variety = varieties.find((v) => v.id.toString() === itemFishVarietyId);
    if (!variety) return;

    const kg = parseFloat(itemKg) || 0;

    if (kg <= 0) {
      alert('Please enter valid weight');
      return;
    }

    // Get rate - either manual or from history
    let rate = 0;
    if (showManualRate) {
      rate = parseFloat(itemRate) || 0;
      if (rate <= 0) {
        alert('Please enter a valid rate');
        return;
      }
    } else {
      // Get last rate for this variety
      const lastRate = await getLastPurchaseRateForVariety(parseInt(itemFishVarietyId));
      if (!lastRate || lastRate === 0) {
        setShowManualRate(true);
        alert(`No previous rate found for ${variety.name}. Please enter rate manually.`);
        return;
      }
      rate = lastRate;
    }

    // Calculate crates based on weight
    const crateWt = parseFloat(crateWeight) || 35;
    const crates = Math.floor(kg / crateWt);
    const remainingKg = kg % crateWt;

    const newItem: BillItemForm = {
      fish_variety_id: parseInt(itemFishVarietyId),
      fish_variety_name: variety.name,
      quantity_crates: crates,
      quantity_kg: remainingKg,
      actual_weight: kg,
      rate_per_kg: rate,
    };

    setBillItems([...billItems, newItem]);
    setItemFishVarietyId('');
    setItemKg('');
    setItemRate('');
    setShowManualRate(false);
  };

  const handleRemoveItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const calculateBillableWeight = (actualWeight: number) => {
    if (!applyWeightDeduction) return actualWeight;
    const deduction = parseFloat(weightDeductionPercentage) || 0;
    return actualWeight * (1 - deduction / 100);
  };

  const calculateItemAmount = (item: BillItemForm) => {
    const billableWeight = calculateBillableWeight(item.actual_weight);
    return billableWeight * item.rate_per_kg;
  };

  const calculateTotals = () => {
    // Gross amount (before weight deduction)
    const grossAmount = billItems.reduce((sum, item) => sum + (item.actual_weight * item.rate_per_kg), 0);

    // Weight deduction
    const weightDeduction = applyWeightDeduction ? parseFloat(weightDeductionPercentage) || 0 : 0;
    const weightDeductionAmount = grossAmount * (weightDeduction / 100);

    // Subtotal after weight deduction
    const subtotal = billItems.reduce((sum, item) => sum + calculateItemAmount(item), 0);

    // Commission
    const commission = parseFloat(commissionPercentage) || 0;
    const commissionAmount = subtotal * (commission / 100);

    // Other deductions
    const otherDeductionsTotal = otherDeductions.reduce((sum, d) => sum + d.amount, 0);

    // Final total
    const total = subtotal - commissionAmount - otherDeductionsTotal;
    const paid = parseFloat(amountPaid) || 0;
    const balance = total - paid;

    return {
      grossAmount,
      weightDeduction,
      weightDeductionAmount,
      subtotal,
      commissionAmount,
      otherDeductionsTotal,
      total,
      paid,
      balance,
    };
  };

  const totals = calculateTotals();

  const handleAddDeduction = () => {
    if (!deductionName || !deductionAmount) {
      alert('Please enter deduction name and amount');
      return;
    }

    setOtherDeductions([...otherDeductions, { name: deductionName, amount: parseFloat(deductionAmount) }]);
    setDeductionName('');
    setDeductionAmount('');
  };

  const handleRemoveDeduction = (index: number) => {
    setOtherDeductions(otherDeductions.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedFarmerId || billItems.length === 0) {
      alert('Please select farmer and add items');
      return;
    }

    setSubmitting(true);
    const deduction = applyWeightDeduction ? parseFloat(weightDeductionPercentage) : 0;

    const result = await createPurchaseBill(
      parseInt(selectedFarmerId),
      date,
      billItems,
      parseFloat(commissionPercentage) || 0,
      deduction,
      otherDeductions,
      notes || undefined,
      parseFloat(amountPaid) || 0
    );

    if (result) {
      alert('Purchase bill created successfully!');
      // Reset form
      setSelectedFarmerId('');
      setBillItems([]);
      setCommissionPercentage('0');
      setWeightDeductionPercentage('5');
      setApplyWeightDeduction(true);
      setOtherDeductions([]);
      setNotes('');
      setAmountPaid('0');
      await loadData();
    } else {
      alert('Failed to create purchase bill');
    }
    setSubmitting(false);
  };

  const handleDeleteBill = async (billId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this bill?')) return;

    const success = await deletePurchaseBill(billId);
    if (success) {
      setBills((prev) => prev.filter((b) => b.id !== billId));
      if (expandedBillId === billId) {
        setExpandedBillId(null);
      }
    } else {
      alert('Failed to delete bill');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'partial':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-red-100 text-red-700';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Purchase Bills</h1>
              <p className="text-sm text-gray-500">Generate bills for farmer purchases</p>
            </div>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Date
            </label>
            <div className="flex items-center">
              <button
                onClick={() => {
                  const d = new Date(date);
                  d.setDate(d.getDate() - 1);
                  setDate(d.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 border-r-0 rounded-l-lg text-gray-600 font-medium transition-colors"
              >
                ‹
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={() => {
                  const d = new Date(date);
                  d.setDate(d.getDate() + 1);
                  setDate(d.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 border-l-0 rounded-r-lg text-gray-600 font-medium transition-colors"
              >
                ›
              </button>
              <button
                onClick={() => setDate(new Date().toISOString().split('T')[0])}
                className="ml-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white text-sm font-semibold transition-colors shadow-sm"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Bill Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Create Purchase Bill</h2>

            {/* Farmer Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Farmer</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    options={farmers}
                    value={selectedFarmerId}
                    onChange={setSelectedFarmerId}
                    placeholder="Select Farmer"
                  />
                </div>
                <button
                  onClick={handleLoadPurchasesForFarmer}
                  disabled={!selectedFarmerId}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load Purchases
                </button>
              </div>
            </div>

            {/* Add Item Form */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Add Item</h3>
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-gray-600">Crate weight (kg):</label>
                  <input
                    type="number"
                    value={crateWeight}
                    onChange={(e) => setCrateWeight(e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                    min="1"
                    step="0.1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <SearchableSelect
                    options={varieties}
                    value={itemFishVarietyId}
                    onChange={setItemFishVarietyId}
                    placeholder="Select Fish Type"
                  />
                  <input
                    type="number"
                    placeholder="Total Weight (Kg)"
                    value={itemKg}
                    onChange={(e) => setItemKg(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    step="0.01"
                    min="0"
                  />
                </div>
                {showManualRate && (
                  <input
                    type="number"
                    placeholder="Rate per Kg (₹)"
                    value={itemRate}
                    onChange={(e) => setItemRate(e.target.value)}
                    className="w-full px-3 py-2 border border-orange-400 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-orange-50"
                    step="0.01"
                    min="0"
                  />
                )}
                <button
                  onClick={handleAddItem}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                >
                  + Add Item
                </button>
                <div className="flex items-center justify-between text-xs">
                  <p className="text-gray-500">
                    {showManualRate ? 'Enter rate manually' : 'Rate auto-fetched from last bill'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowManualRate(!showManualRate)}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {showManualRate ? 'Use Auto Rate' : 'Enter Manual Rate'}
                  </button>
                </div>
              </div>
            </div>

            {/* Bill Items List */}
            {billItems.length > 0 && (
              <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h3 className="text-sm font-semibold text-orange-800 mb-3">
                  Bill Items ({billItems.length})
                </h3>
                <div className="space-y-2 mb-4">
                  {billItems.map((item, index) => {
                    const billableWeight = calculateBillableWeight(item.actual_weight);
                    const amount = calculateItemAmount(item);
                    return (
                      <div
                        key={index}
                        className="bg-white p-3 rounded-lg border border-orange-100 text-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-gray-800">{item.fish_variety_name}</div>
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600 text-xs">
                          <div className="text-gray-500">Total Weight:</div>
                          <div className="text-right font-medium">{item.actual_weight.toFixed(2)} kg</div>

                          {item.quantity_crates > 0 && (
                            <>
                              <div className="text-gray-500">Crates:</div>
                              <div className="text-right">{item.quantity_crates} × {parseFloat(crateWeight)} kg</div>
                            </>
                          )}

                          {item.quantity_kg > 0 && (
                            <>
                              <div className="text-gray-500">Loose:</div>
                              <div className="text-right">{item.quantity_kg.toFixed(2)} kg</div>
                            </>
                          )}

                          <div className="text-orange-700 font-medium">Billable Weight (95%):</div>
                          <div className="text-right text-orange-700 font-medium">{billableWeight.toFixed(2)} kg</div>

                          <div className="text-gray-500">Rate:</div>
                          <div className="text-right">₹{item.rate_per_kg}/kg</div>

                          <div className="font-semibold text-gray-800 border-t border-gray-200 pt-1 mt-1">Amount:</div>
                          <div className="text-right font-semibold text-gray-800 border-t border-gray-200 pt-1 mt-1">₹{amount.toFixed(2)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weight Deduction Toggle */}
                <div className="mb-3 p-3 bg-white rounded-lg border border-orange-200">
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={applyWeightDeduction}
                      onChange={(e) => setApplyWeightDeduction(e.target.checked)}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Apply Weight Deduction
                    </span>
                  </label>
                  {applyWeightDeduction && (
                    <input
                      type="number"
                      placeholder="Weight Deduction %"
                      value={weightDeductionPercentage}
                      onChange={(e) => setWeightDeductionPercentage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  )}
                </div>

                {/* Commission */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission %
                  </label>
                  <input
                    type="number"
                    placeholder="Commission %"
                    value={commissionPercentage}
                    onChange={(e) => setCommissionPercentage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    step="0.1"
                    min="0"
                  />
                </div>

                {/* Amount Paid */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    placeholder="Amount Paid"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    step="0.01"
                    min="0"
                  />
                </div>

                {/* Notes */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    placeholder="Notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                {/* Other Deductions */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Other Deductions (Ice, Transport, etc.)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Deduction name"
                      value={deductionName}
                      onChange={(e) => setDeductionName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={deductionAmount}
                      onChange={(e) => setDeductionAmount(e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                      step="0.01"
                      min="0"
                    />
                    <button
                      onClick={handleAddDeduction}
                      className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
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
                <div className="bg-white p-3 rounded-lg border border-orange-300 space-y-1 text-sm mb-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Gross Amount:</span>
                    <span>₹{totals.grossAmount.toFixed(2)}</span>
                  </div>
                  {totals.weightDeductionAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Weight Deduction ({totals.weightDeduction}%):</span>
                      <span>-₹{totals.weightDeductionAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t border-gray-200 pt-1">
                    <span>Subtotal (Billable):</span>
                    <span>₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.commissionAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Commission ({commissionPercentage}%):</span>
                      <span>-₹{totals.commissionAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.otherDeductionsTotal > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Other Deductions:</span>
                      <span>-₹{totals.otherDeductionsTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-gray-200 pt-1 text-base">
                    <span>Total:</span>
                    <span>₹{totals.total.toFixed(2)}</span>
                  </div>
                  {totals.paid > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Paid:</span>
                      <span>-₹{totals.paid.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-orange-700 border-t border-gray-200 pt-1">
                    <span>Balance Due:</span>
                    <span>₹{totals.balance.toFixed(2)}</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {submitting ? 'Creating Bill...' : 'Create Bill'}
                </button>
              </div>
            )}
          </div>

          {/* Bills List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-700">Today's Purchase Bills</h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : bills.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No purchase bills for this date
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[calc(100vh-200px)] overflow-y-auto">
                {bills.map((bill) => (
                  <div key={bill.id} className="hover:bg-gray-50">
                    {/* Bill Row */}
                    <div
                      className="px-4 py-3 flex items-center justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedBillId(expandedBillId === bill.id ? null : bill.id)
                      }
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-semibold text-orange-600">{bill.bill_number}</div>
                          <div className="text-sm text-gray-600">{bill.farmer_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold text-gray-800">
                            ₹{bill.total.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            Balance: ₹{(bill.balance_due || 0).toLocaleString()}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            bill.payment_status
                          )}`}
                        >
                          {bill.payment_status}
                        </span>
                        <button
                          onClick={(e) => handleDeleteBill(bill.id, e)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            expandedBillId === bill.id ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedBillId === bill.id && (
                      <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                        <div className="mt-3 text-sm space-y-2">
                          {bill.items.map((item, idx) => (
                            <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                              <div className="font-medium text-gray-800 mb-1">
                                {item.fish_variety_name}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                <div>
                                  Qty: {item.quantity_crates}cr, {item.quantity_kg}kg
                                </div>
                                <div>Rate: ₹{item.rate_per_kg}/kg</div>
                                <div>Actual: {item.actual_weight.toFixed(2)} kg</div>
                                <div className="text-orange-600 font-medium">
                                  Billable: {item.billable_weight.toFixed(2)} kg
                                </div>
                                <div className="col-span-2 font-semibold text-gray-800 border-t pt-1">
                                  Amount: ₹{item.amount.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}

                          <div className="bg-white p-3 rounded border border-orange-300 space-y-1">
                            <div className="flex justify-between text-gray-600">
                              <span>Gross Amount:</span>
                              <span>₹{(bill.gross_amount || 0).toFixed(2)}</span>
                            </div>
                            {(bill.weight_deduction_amount || 0) > 0 && (
                              <div className="flex justify-between text-red-600">
                                <span>Weight Deduction ({bill.weight_deduction_percentage}%):</span>
                                <span>-₹{bill.weight_deduction_amount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-medium border-t pt-1">
                              <span>Subtotal (Billable):</span>
                              <span>₹{bill.subtotal.toFixed(2)}</span>
                            </div>
                            {bill.commission_amount > 0 && (
                              <div className="flex justify-between text-red-600">
                                <span>Commission ({bill.commission_percentage}%):</span>
                                <span>-₹{bill.commission_amount.toFixed(2)}</span>
                              </div>
                            )}
                            {bill.other_deductions && bill.other_deductions.length > 0 && (
                              <>
                                {bill.other_deductions.map((deduction: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-red-600 text-xs">
                                    <span>{deduction.name}:</span>
                                    <span>-₹{deduction.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                              </>
                            )}
                            {(bill.other_deductions_total || 0) > 0 && (
                              <div className="flex justify-between text-red-600">
                                <span>Other Deductions Total:</span>
                                <span>-₹{bill.other_deductions_total.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold border-t pt-1 text-base">
                              <span>Total:</span>
                              <span>₹{bill.total.toFixed(2)}</span>
                            </div>
                            {bill.amount_paid > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Paid:</span>
                                <span>-₹{bill.amount_paid.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-orange-700 border-t pt-1">
                              <span>Balance Due:</span>
                              <span>₹{bill.balance_due.toFixed(2)}</span>
                            </div>
                          </div>

                          {bill.notes && (
                            <div className="text-xs text-gray-600 bg-white p-2 rounded">
                              <span className="font-medium">Notes:</span> {bill.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
