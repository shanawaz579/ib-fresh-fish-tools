'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFishVarieties, getPurchasesByDate, addPurchase, deletePurchase, updatePurchase, getFarmers } from '@/app/actions/stock';
import SearchableSelect from '@/components/SearchableSelect';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import PurchaseBillModal from '@/components/PurchaseBillModal';
import type { Purchase, FishVariety, Farmer } from '@/app/actions/stock';

type GroupedPurchase = {
  farmerName: string;
  farmerId: number;
  items: { varietyId: number; varietyName: string; crates: number; kg: number; id: number; farmerId: number }[];
  totalCrates: number;
  totalKg: number;
};

export default function PurchasePage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [groupedPurchases, setGroupedPurchases] = useState<GroupedPurchase[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);

  // Bill modal state
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<{ id: number; name: string } | null>(null);
  const [farmerPurchases, setFarmerPurchases] = useState<any[]>([]);

  // Form state
  const [farmerId, setFarmerId] = useState('');
  const [fishVarietyId, setFishVarietyId] = useState('');
  const [quantityCrates, setQuantityCrates] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tempItems, setTempItems] = useState<{ varietyId: number; varietyName: string; crates: number; kg: number }[]>([]);
  const [editingItem, setEditingItem] = useState<{ id: number; farmerId: number; farmerName: string; varietyId: number; varietyName: string; crates: number; kg: number } | null>(null);

  // Calculate daily totals
  const dailyTotals = {
    crates: purchases.reduce((sum, p) => sum + p.quantity_crates, 0),
    kg: purchases.reduce((sum, p) => sum + p.quantity_kg, 0),
    farmers: new Set(purchases.map(p => p.farmer_id)).size,
    items: purchases.length,
  };

  useEffect(() => {
    loadData();
  }, [date]);

  useEffect(() => {
    groupPurchases();
  }, [purchases]);

  const loadData = async () => {
    setLoading(true);
    const [purchasesData, varietiesData, farmersData] = await Promise.all([
      getPurchasesByDate(date),
      getFishVarieties(),
      getFarmers(),
    ]);
    setPurchases(purchasesData);
    setVarieties(varietiesData);
    setFarmers(farmersData);
    setLoading(false);
  };

  const groupPurchases = () => {
    const grouped: { [key: string]: GroupedPurchase } = {};

    purchases.forEach((purchase) => {
      const farmerName = purchase.farmer_name || 'Unknown';
      if (!grouped[farmerName]) {
        grouped[farmerName] = {
          farmerName: farmerName,
          farmerId: purchase.farmer_id,
          items: [],
          totalCrates: 0,
          totalKg: 0,
        };
      }

      grouped[farmerName].items.push({
        varietyId: purchase.fish_variety_id,
        varietyName: purchase.fish_variety_name || 'Unknown',
        crates: purchase.quantity_crates,
        kg: purchase.quantity_kg,
        id: purchase.id,
        farmerId: purchase.farmer_id,
      });

      // Update totals
      grouped[farmerName].totalCrates += purchase.quantity_crates;
      grouped[farmerName].totalKg += purchase.quantity_kg;
    });

    setGroupedPurchases(Object.values(grouped));
  };

  const handleAddItem = () => {
    if (!fishVarietyId || (!quantityCrates && !quantityKg)) {
      alert('Please select fish type and quantity');
      return;
    }

    const selectedVariety = varieties.find((v) => v.id.toString() === fishVarietyId);
    if (!selectedVariety) return;

    // Validate non-negative values
    let crates = parseInt(quantityCrates) || 0;
    let kg = parseFloat(quantityKg) || 0;
    if (crates < 0) crates = 0;
    if (kg < 0) kg = 0;

    // Check for duplicate variety in temp items
    const existingIndex = tempItems.findIndex(item => item.varietyId === parseInt(fishVarietyId));
    if (existingIndex >= 0) {
      // Update existing item instead of adding duplicate
      const updatedItems = [...tempItems];
      updatedItems[existingIndex].crates += crates;
      updatedItems[existingIndex].kg += kg;
      setTempItems(updatedItems);
    } else {
      setTempItems([
        ...tempItems,
        {
          varietyId: parseInt(fishVarietyId),
          varietyName: selectedVariety.name,
          crates,
          kg,
        },
      ]);
    }

    setFishVarietyId('');
    setQuantityCrates('');
    setQuantityKg('');
  };

  const handleRemoveTempItem = (index: number) => {
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  const handleSubmitAll = async () => {
    if (!farmerId || tempItems.length === 0) {
      alert('Please select a farmer and add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      for (const item of tempItems) {
        await addPurchase(
          parseInt(farmerId),
          item.varietyId,
          item.crates,
          item.kg,
          date
        );
      }
      setFarmerId('');
      setTempItems([]);
      await loadData();
    } catch (err) {
      alert('Failed to add purchases');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this purchase?')) {
      const success = await deletePurchase(id);
      if (success) {
        await loadData();
      } else {
        alert('Failed to delete purchase');
      }
    }
  };

  const handleEditItem = (item: any) => {
    const farmer = farmers.find(f => f.id === item.farmerId);
    setEditingItem({
      id: item.id,
      farmerId: item.farmerId,
      farmerName: farmer?.name || 'Unknown',
      varietyId: item.varietyId,
      varietyName: item.varietyName,
      crates: item.crates,
      kg: item.kg,
    });
    setFarmerId(item.farmerId.toString());
    setFishVarietyId(item.varietyId.toString());
    setQuantityCrates(item.crates.toString());
    setQuantityKg(item.kg.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !farmerId || !fishVarietyId) {
      alert('Please fill all fields');
      return;
    }

    setSubmitting(true);
    const success = await updatePurchase(
      editingItem.id,
      parseInt(farmerId),
      parseInt(fishVarietyId),
      parseInt(quantityCrates) || 0,
      parseFloat(quantityKg) || 0
    );

    if (success) {
      setEditingItem(null);
      setFarmerId('');
      setFishVarietyId('');
      setQuantityCrates('');
      setQuantityKg('');
      await loadData();
    } else {
      alert('Failed to update purchase');
    }
    setSubmitting(false);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setFarmerId('');
    setFishVarietyId('');
    setQuantityCrates('');
    setQuantityKg('');
  };

  const handleCreateBillForFarmer = (farmerId: number, farmerName: string) => {
    const farmerGroup = groupedPurchases.find(g => g.farmerId === farmerId);
    if (!farmerGroup) return;

    setSelectedFarmer({ id: farmerId, name: farmerName });
    setFarmerPurchases(farmerGroup.items);
    setShowBillModal(true);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50">
        {/* Header Section */}
        <div className="px-6 py-5 bg-white border-b border-gray-200 shadow-sm">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Records</h1>
                <p className="text-sm text-gray-500">Record fish purchases from farmers</p>
              </div>
            </div>

            {/* Daily Summary Stats */}
            {!loading && purchases.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="text-center px-4 py-2 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-700">{dailyTotals.crates}</div>
                  <div className="text-xs text-green-600 font-medium">Total Crates</div>
                </div>
                <div className="text-center px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">{dailyTotals.kg.toFixed(1)}</div>
                  <div className="text-xs text-blue-600 font-medium">Total Kg</div>
                </div>
                <div className="text-center px-4 py-2 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-2xl font-bold text-purple-700">{dailyTotals.farmers}</div>
                  <div className="text-xs text-purple-600 font-medium">Farmers</div>
                </div>
              </div>
            )}
          </div>

          {/* Date Picker Row */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
            <div className="flex items-center">
              <button
                onClick={() => {
                  const d = new Date(date);
                  d.setDate(d.getDate() - 1);
                  setDate(d.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 border-r-0 rounded-l-lg text-gray-600 font-medium transition-colors"
                title="Previous day"
              >
                ‹
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={() => {
                  const d = new Date(date);
                  d.setDate(d.getDate() + 1);
                  setDate(d.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 border-l-0 rounded-r-lg text-gray-600 font-medium transition-colors"
                title="Next day"
              >
                ›
              </button>
              <button
                onClick={() => setDate(new Date().toISOString().split('T')[0])}
                className="ml-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white text-sm font-semibold transition-colors shadow-sm"
                title="Go to today"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">

      {/* Add Purchase Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          {editingItem ? `Edit Purchase - ${editingItem.farmerName}` : 'Add New Purchase'}
        </h2>
        
        {editingItem ? (
          <div className="space-y-4 bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-600 font-medium">Editing Purchase</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Farmer</label>
              <SearchableSelect
                options={farmers}
                value={farmerId}
                onChange={setFarmerId}
                placeholder="Select Farmer"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <SearchableSelect
                options={varieties}
                value={fishVarietyId}
                onChange={setFishVarietyId}
                placeholder="Select Fish Type"
              />
              <input
                type="number"
                placeholder="Crates"
                value={quantityCrates}
                onChange={(e) => setQuantityCrates(e.target.value)}
                className="px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                min="0"
              />
              <input
                type="number"
                placeholder="Kg"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                step="0.01"
                min="0"
              />
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={submitting}
                className="px-4 py-2.5 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors shadow-sm"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Farmer Selection */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Farmer</label>
              <div className="flex gap-3">
                <div className="flex-1 max-w-md">
                  <SearchableSelect
                    options={farmers}
                    value={farmerId}
                    onChange={setFarmerId}
                    placeholder="Select Farmer"
                  />
                </div>
                {tempItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFarmerId('');
                      setTempItems([]);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Items Form - Add multiple items */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Add Fish Items {farmerId && <span className="normal-case text-green-600">for {farmers.find(f => f.id.toString() === farmerId)?.name}</span>}
              </label>
              <div className="flex flex-wrap gap-3">
                <div className="w-48">
                  <SearchableSelect
                    options={varieties}
                    value={fishVarietyId}
                    onChange={setFishVarietyId}
                    placeholder="Fish Type"
                  />
                </div>
                <input
                  type="number"
                  placeholder="Crates"
                  value={quantityCrates}
                  onChange={(e) => setQuantityCrates(e.target.value)}
                  className="w-24 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Kg"
                  value={quantityKg}
                  onChange={(e) => setQuantityKg(e.target.value)}
                  className="w-24 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                  step="0.01"
                  min="0"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!farmerId}
                  className="px-5 py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  + Add Item
                </button>
              </div>
            </div>

            {/* Preview of items to be added */}
            {tempItems.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-green-800">
                    Items to save ({tempItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleSubmitAll}
                    disabled={tempItems.length === 0 || submitting || !farmerId}
                    className="px-5 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {submitting ? 'Saving...' : 'Save All Items'}
                  </button>
                </div>
                <div className="space-y-2">
                  {tempItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-green-100 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        <span className="font-medium text-gray-800">{item.varietyName}</span>
                        <span className="text-gray-600">
                          {item.crates > 0 && `${item.crates} crates`}
                          {item.crates > 0 && item.kg > 0 && ' + '}
                          {item.kg > 0 && `${item.kg} kg`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTempItem(index)}
                        className="px-3 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Purchases Table - Grouped by Farmer */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50">
          <h2 className="text-lg font-semibold text-gray-800">Today's Purchases</h2>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-500">Loading...</div>
        ) : groupedPurchases.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p>No purchases for this date</p>
            <p className="text-sm mt-1">Add your first purchase using the form above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {groupedPurchases.map((group) => (
              <div key={group.farmerName} className="p-4 hover:bg-gray-50/50 transition-colors">
                {/* Farmer Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
                      <span className="text-green-700 font-bold text-sm">
                        {group.farmerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{group.farmerName}</h3>
                      <p className="text-xs text-gray-500">{group.items.length} item{group.items.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCreateBillForFarmer(group.farmerId, group.farmerName)}
                      className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-2"
                      title="Create purchase bill for this farmer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Create Bill
                    </button>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">{group.totalCrates} cr</div>
                      {group.totalKg > 0 && (
                        <div className="text-xs text-gray-500">+ {group.totalKg} kg</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="ml-13 space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        <span className="font-medium text-gray-700">{item.varietyName}</span>
                        <span className="text-gray-500">
                          {item.crates > 0 && `${item.crates} crates`}
                          {item.crates > 0 && item.kg > 0 && ' + '}
                          {item.kg > 0 && `${item.kg} kg`}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="px-3 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      </div>

      {/* Purchase Bill Modal */}
      <PurchaseBillModal
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
        farmer={selectedFarmer}
        purchases={farmerPurchases}
        date={date}
        onBillCreated={() => {
          loadData(); // Refresh purchases
        }}
      />
    </ProtectedRoute>
  );
}
