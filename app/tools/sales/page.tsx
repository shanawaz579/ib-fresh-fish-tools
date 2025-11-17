'use client';

import { useState, useEffect } from 'react';
import { getFishVarieties, getSalesByDate, addSale, deleteSale, updateSale, getCustomers } from '@/app/actions/stock';
import SearchableSelect from '@/components/SearchableSelect';
import type { Sale, FishVariety, Customer } from '@/app/actions/stock';

type GroupedSale = {
  customerName: string;
  items: { varietyId: number; varietyName: string; crates: number; kg: number; id: number; customerId: number }[];
};

export default function SalesPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [groupedSales, setGroupedSales] = useState<GroupedSale[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [fishVarietyId, setFishVarietyId] = useState('');
  const [quantityCrates, setQuantityCrates] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tempItems, setTempItems] = useState<{ varietyId: number; varietyName: string; crates: number; kg: number }[]>([]);
  const [editingItem, setEditingItem] = useState<{ id: number; customerId: number; customerName: string; varietyId: number; varietyName: string; crates: number; kg: number } | null>(null);

  useEffect(() => {
    loadData();
  }, [date]);

  useEffect(() => {
    groupSales();
  }, [sales]);

  const loadData = async () => {
    setLoading(true);
    const [salesData, varietiesData, customersData] = await Promise.all([
      getSalesByDate(date),
      getFishVarieties(),
      getCustomers(),
    ]);
    setSales(salesData);
    setVarieties(varietiesData);
    setCustomers(customersData);
    setLoading(false);
  };

  const groupSales = () => {
    const grouped: { [key: string]: GroupedSale } = {};

    sales.forEach((sale) => {
      const customerName = sale.customer_name || 'Unknown';
      if (!grouped[customerName]) {
        grouped[customerName] = {
          customerName: customerName,
          items: [],
        };
      }

      grouped[customerName].items.push({
        varietyId: sale.fish_variety_id,
        varietyName: sale.fish_variety_name || 'Unknown',
        crates: sale.quantity_crates,
        kg: sale.quantity_kg,
        id: sale.id,
        customerId: sale.customer_id,
      });
    });

    setGroupedSales(Object.values(grouped));
  };

  const handleAddItem = () => {
    if (!fishVarietyId || (!quantityCrates && !quantityKg)) {
      alert('Please select fish type and quantity');
      return;
    }

    const selectedVariety = varieties.find((v) => v.id.toString() === fishVarietyId);
    if (!selectedVariety) return;

    setTempItems([
      ...tempItems,
      {
        varietyId: parseInt(fishVarietyId),
        varietyName: selectedVariety.name,
        crates: parseInt(quantityCrates) || 0,
        kg: parseFloat(quantityKg) || 0,
      },
    ]);

    setFishVarietyId('');
    setQuantityCrates('');
    setQuantityKg('');
  };

  const handleRemoveTempItem = (index: number) => {
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  const handleSubmitAll = async () => {
    if (!customerId || tempItems.length === 0) {
      alert('Please select a customer and add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      for (const item of tempItems) {
        await addSale(
          parseInt(customerId),
          item.varietyId,
          item.crates,
          item.kg,
          date
        );
      }
      setCustomerId('');
      setTempItems([]);
      await loadData();
    } catch (err) {
      alert('Failed to add sales');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this sale?')) {
      const success = await deleteSale(id);
      if (success) {
        await loadData();
      } else {
        alert('Failed to delete sale');
      }
    }
  };

  const handleEditItem = (item: any) => {
    const customer = customers.find(c => c.id === item.customerId);
    setEditingItem({
      id: item.id,
      customerId: item.customerId,
      customerName: customer?.name || 'Unknown',
      varietyId: item.varietyId,
      varietyName: item.varietyName,
      crates: item.crates,
      kg: item.kg,
    });
    setCustomerId(item.customerId.toString());
    setFishVarietyId(item.varietyId.toString());
    setQuantityCrates(item.crates.toString());
    setQuantityKg(item.kg.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !customerId || !fishVarietyId) {
      alert('Please fill all fields');
      return;
    }

    setSubmitting(true);
    const success = await updateSale(
      editingItem.id,
      parseInt(customerId),
      parseInt(fishVarietyId),
      parseInt(quantityCrates) || 0,
      parseFloat(quantityKg) || 0
    );

    if (success) {
      setEditingItem(null);
      setCustomerId('');
      setFishVarietyId('');
      setQuantityCrates('');
      setQuantityKg('');
      await loadData();
    } else {
      alert('Failed to update sale');
    }
    setSubmitting(false);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setCustomerId('');
    setFishVarietyId('');
    setQuantityCrates('');
    setQuantityKg('');
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 text-primary">Sales Records</h1>

      {/* Date Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {/* Add Sale Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">
          {editingItem ? `Edit Sale - ${editingItem.customerName}` : 'Add Sales'}
        </h2>
        
        {editingItem ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Customer</label>
              <SearchableSelect
                options={customers}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Select Customer"
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
                className="px-4 py-2 border border-gray-300 rounded-lg"
                min="0"
              />
              <input
                type="number"
                placeholder="Kg"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
                step="0.01"
                min="0"
              />
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={submitting}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Customer Selection - One time entry */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Customer</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <SearchableSelect
                    options={customers}
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder="Select Customer"
                  />
                </div>
                {tempItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId('');
                      setTempItems([]);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Items Form - Add multiple items */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Add Items for {customerId ? customers.find(c => c.id.toString() === customerId)?.name || 'Customer' : 'Customer'}
              </label>
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
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                  min="0"
                />
                <input
                  type="number"
                  placeholder="Kg"
                  value={quantityKg}
                  onChange={(e) => setQuantityKg(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                  step="0.01"
                  min="0"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!customerId}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAll}
                  disabled={tempItems.length === 0 || submitting || !customerId}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed col-span-1"
                >
                  {submitting ? 'Saving...' : 'Save All'}
                </button>
              </div>
            </div>

            {/* Preview of items to be added */}
            {tempItems.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold mb-3 text-blue-900">
                  Items to be added for {customers.find(c => c.id.toString() === customerId)?.name || 'Customer'}:
                </h3>
                <div className="space-y-2">
                  {tempItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white p-3 rounded border border-blue-100"
                    >
                      <span className="text-sm">
                        <strong>{item.varietyName}</strong> - {item.crates > 0 && `${item.crates} crates`}
                        {item.crates > 0 && item.kg > 0 && ' + '}
                        {item.kg > 0 && `${item.kg} kg`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTempItem(index)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
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

      {/* Sales Table - Grouped by Customer */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Customer Name</th>
              <th className="px-6 py-3 text-left font-semibold">Fish Items</th>
              <th className="px-6 py-3 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : groupedSales.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                  No sales for this date
                </td>
              </tr>
            ) : (
              groupedSales.map((group) => (
                <tr key={group.customerName} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold">{group.customerName}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm">
                            <strong>{item.varietyName}</strong> - {item.crates > 0 && `${item.crates} crates`}
                            {item.crates > 0 && item.kg > 0 && ' + '}
                            {item.kg > 0 && `${item.kg} kg`}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
