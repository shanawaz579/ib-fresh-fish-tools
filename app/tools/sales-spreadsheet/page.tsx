'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFishVarieties, getPurchasesByDate, getSalesByDate, addSale, deleteSale, updateSale, getCustomers } from '@/app/actions/stock';
import type { FishVariety, Customer } from '@/app/actions/stock';
import MultiSelect from '@/components/MultiSelect';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Hardcoded order for fish varieties
const VARIETY_ORDER = ['Pangasius', 'Roopchand', 'Rohu', 'Katla', 'Tilapia', 'Silver Carp', 'Grass Carp', 'Common Carp'];
const SIZE_ORDER = ['Big', 'Medium', 'Small'];

interface SaleRow {
  id?: number;
  customerId: number | null;
  items: { [varietyId: number]: { crates: number; kg: number; saleId?: number } };
}

interface ColumnConfig {
  varietyId: number;
  varietyName: string;
}

export default function SalesSpreadsheetPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);

  // Spreadsheet state
  const [rows, setRows] = useState<SaleRow[]>([{ customerId: null, items: {} }]);
  const [columnOrder, setColumnOrder] = useState<ColumnConfig[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  
  // Selected varieties for display
  const [selectedVarietyIds, setSelectedVarietyIds] = useState<number[]>([]);

  // Helper function to sort varieties by hardcoded order
  const sortByHardcodedOrder = (ids: number[], allVarieties: FishVariety[]) => {
    return ids.sort((a, b) => {
      const varietyA = allVarieties.find((v: FishVariety) => v.id === a);
      const varietyB = allVarieties.find((v: FishVariety) => v.id === b);
      const nameA = varietyA?.name || '';
      const nameB = varietyB?.name || '';
      
      // Create a lowercase version for case-insensitive matching
      const lowerNameA = nameA.toLowerCase();
      const lowerNameB = nameB.toLowerCase();
      
      // Find variety type order (e.g., Pangasius, Rohu, etc.)
      const varietyOrderA = VARIETY_ORDER.findIndex(p => lowerNameA.includes(p.toLowerCase()));
      const varietyOrderB = VARIETY_ORDER.findIndex(p => lowerNameB.includes(p.toLowerCase()));
      
      // Find size order (Big, Medium, Small)
      const sizeOrderA = SIZE_ORDER.findIndex(s => nameA.includes(s));
      const sizeOrderB = SIZE_ORDER.findIndex(s => nameB.includes(s));
      
      // If variety orders are different, sort by variety order first
      if (varietyOrderA !== varietyOrderB) {
        if (varietyOrderA === -1) return 1;
        if (varietyOrderB === -1) return -1;
        return varietyOrderA - varietyOrderB;
      }
      
      // If same variety type, sort by size order
      if (sizeOrderA !== sizeOrderB) {
        if (sizeOrderA === -1 && sizeOrderB === -1) return a - b;
        if (sizeOrderA === -1) return 1;
        if (sizeOrderB === -1) return -1;
        return sizeOrderA - sizeOrderB;
      }
      
      // If same variety and size, sort by ID
      return a - b;
    });
  };

  useEffect(() => {
    loadData();
  }, [date]);

  // Sync columnOrder whenever selectedVarietyIds changes
  useEffect(() => {
    const newOrder = selectedVarietyIds.map(id => {
      const v = varieties.find(vv => vv.id === id);
      return { varietyId: id, varietyName: v?.name || '' };
    });
    setColumnOrder(newOrder);
  }, [selectedVarietyIds, varieties]);

  const loadData = async () => {
    setLoading(true);
    const [varietiesData, customersData, purchasesData, salesData] = await Promise.all([
      getFishVarieties(),
      getCustomers(),
      getPurchasesByDate(date),
      getSalesByDate(date),
    ]);
    
    setVarieties(varietiesData);
    setCustomers(customersData);
    setPurchases(purchasesData);
    setSales(salesData);

    // Get varieties that have purchases on this date
    let purchaseVarietyIds = [...new Set(purchasesData.map(p => p.fish_variety_id))];
    purchaseVarietyIds = sortByHardcodedOrder(purchaseVarietyIds, varietiesData);
    
    // Set varieties with purchases for this date as default
    if (purchaseVarietyIds.length > 0) {
      setSelectedVarietyIds(purchaseVarietyIds);
    } else {
      // If no purchases, use the default varieties in preferred order
      const defaultNames = ['Pangasius Big', 'Rohu Big/Medium', 'Katla Big/Medium', 'Tilapia Big/Medium'];
      const defaultIds = varietiesData
        .filter((v: FishVariety) => defaultNames.includes(v.name))
        .map((v: FishVariety) => v.id);
      const sortedDefaultIds = sortByHardcodedOrder(defaultIds, varietiesData);
      setSelectedVarietyIds(sortedDefaultIds);
    }

    // Load existing sales
    loadExistingSales(salesData, varietiesData);
    setLoading(false);
  };

  const loadExistingSales = (salesData: any[], varietiesData: FishVariety[]) => {
    if (salesData.length === 0) {
      setRows([{ customerId: null, items: {} }]);
      return;
    }

    const grouped: { [customerId: number]: { [varietyId: number]: any[] } } = {};

    salesData.forEach((sale) => {
      if (!grouped[sale.customer_id]) grouped[sale.customer_id] = {};
      if (!grouped[sale.customer_id][sale.fish_variety_id]) {
        grouped[sale.customer_id][sale.fish_variety_id] = [];
      }
      grouped[sale.customer_id][sale.fish_variety_id].push(sale);
    });

    // Maintain customer order in which they were added (by first appearance in sales data)
    // Latest added should be on top
    const sortedCustomerIds = Array.from(new Map(
      salesData.map(sale => [sale.customer_id, sale.customer_id])
    ).values()).reverse();

    const newRows: SaleRow[] = sortedCustomerIds.map((customerId) => {
      const items = grouped[customerId];
      return {
        customerId,
        items: Object.entries(items).reduce(
          (acc, [varietyId, sales]) => {
            const total = sales.reduce(
              (sum, s) => ({ crates: sum.crates + s.quantity_crates, kg: sum.kg + s.quantity_kg }),
              { crates: 0, kg: 0 }
            );
            return {
              ...acc,
              [parseInt(varietyId)]: {
                crates: total.crates,
                kg: total.kg,
                saleId: sales[0].id,
              },
            };
          },
          {}
        ),
      };
    });

    setRows(newRows.length > 0 ? newRows : [{ customerId: null, items: {} }]);
  };

  // Calculate total purchases for a variety (for header display)
  const getTotalPurchases = (varietyId: number) => {
    return purchases.reduce(
      (sum, p) => p.fish_variety_id === varietyId ? { crates: sum.crates + p.quantity_crates, kg: sum.kg + p.quantity_kg } : sum,
      { crates: 0, kg: 0 }
    );
  };

  // Calculate available stock for a variety (purchases - database sales, for footer)
  const getAvailableStock = (varietyId: number) => {
    // Sum purchases for this variety on selected date
    const totalPurchased = purchases.reduce(
      (sum, p) => p.fish_variety_id === varietyId ? { crates: sum.crates + p.quantity_crates, kg: sum.kg + p.quantity_kg } : sum,
      { crates: 0, kg: 0 }
    );

    // Sum sales for this variety on selected date (from database)
    const totalSoldFromDB = sales.reduce(
      (sum, s) => s.fish_variety_id === varietyId ? { crates: sum.crates + s.quantity_crates, kg: sum.kg + s.quantity_kg } : sum,
      { crates: 0, kg: 0 }
    );

    return {
      crates: totalPurchased.crates - totalSoldFromDB.crates,
      kg: totalPurchased.kg - totalSoldFromDB.kg,
    };
  };

  // Calculate total sold for footer
  const getTotalSold = (varietyId: number) => {
    return rows.reduce(
      (sum, row) => {
        const item = row.items[varietyId];
        return item ? { crates: sum.crates + item.crates, kg: sum.kg + item.kg } : sum;
      },
      { crates: 0, kg: 0 }
    );
  };

  const handleCellChange = useCallback(
    (rowIndex: number, varietyId: number, field: 'crates' | 'kg', value: string) => {
      const numValue = parseFloat(value) || 0;
      const newRows = [...rows];

      if (!newRows[rowIndex].items[varietyId]) {
        newRows[rowIndex].items[varietyId] = { crates: 0, kg: 0 };
      }

      newRows[rowIndex].items[varietyId][field] = numValue;
      setRows(newRows);
    },
    [rows]
  );

  const handleCellBlur = useCallback(
    async (rowIndex: number, varietyId: number) => {
      const row = rows[rowIndex];
      await saveCell(rowIndex, varietyId, row);
    },
    [rows]
  );

  const saveCell = async (rowIndex: number, varietyId: number, row: SaleRow) => {
    if (!row.customerId) return;

    const item = row.items[varietyId];
    if (!item || (item.crates === 0 && item.kg === 0)) {
      if (item?.saleId) {
        await deleteSale(item.saleId);
        // Reload sales data to update footer
        const salesData = await getSalesByDate(date);
        setSales(salesData);
        // Update local state
        const newRows = [...rows];
        delete newRows[rowIndex].items[varietyId];
        setRows(newRows);
      }
      return;
    }

    setSaving(true);
    try {
      if (item.saleId) {
        await updateSale(item.saleId, row.customerId, varietyId, item.crates, item.kg);
      } else {
        const result = await addSale(row.customerId, varietyId, item.crates, item.kg, date);
        if (result) {
          item.saleId = result.id;
          const newRows = [...rows];
          newRows[rowIndex].items[varietyId].saleId = result.id;
          setRows(newRows);
        }
      }
      // Reload sales data to update footer
      const salesData = await getSalesByDate(date);
      setSales(salesData);
    } catch (err) {
      console.error('Error saving sale:', err);
      alert('Failed to save sale');
    }
    setSaving(false);
  };

  const handleCustomerChange = (rowIndex: number, customerId: number | null) => {
    const newRows = [...rows];
    newRows[rowIndex].customerId = customerId;
    setRows(newRows);
  };

  const handleAddRow = () => {
    setRows([...rows, { customerId: null, items: {} }]);
  };

  const handleDeleteRow = async (rowIndex: number) => {
    const row = rows[rowIndex];
    // Delete all sales in this row
    for (const [varietyId, item] of Object.entries(row.items)) {
      if (item.saleId) {
        await deleteSale(item.saleId);
      }
    }
    setRows(rows.filter((_, i) => i !== rowIndex));
    await loadData();
  };

  const handleColumnDragStart = (index: number) => {
    setDraggedColumn(index);
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleColumnDrop = (targetIndex: number) => {
    if (draggedColumn === null || draggedColumn === targetIndex) {
      setDraggedColumn(null);
      return;
    }

    const newColumnOrder = [...columnOrder];
    const [draggedItem] = newColumnOrder.splice(draggedColumn, 1);
    newColumnOrder.splice(targetIndex, 0, draggedItem);
    setColumnOrder(newColumnOrder);
    setDraggedColumn(null);
  };

  const handleVarietyToggle = (varietyId: number) => {
    setSelectedVarietyIds(prev => {
      let updated: number[];
      if (prev.includes(varietyId)) {
        updated = prev.filter(id => id !== varietyId);
      } else {
        updated = [...prev, varietyId];
      }
      return sortByHardcodedOrder(updated, varieties);
    });
  };

  // Calculate total boxes sold by customer
  const getTotalBoxesByCustomer = (customerId: number) => {
    const customerRow = rows.find(r => r.customerId === customerId);
    if (!customerRow) return 0;
    
    return Object.values(customerRow.items).reduce((sum, item) => {
      return sum + (item.crates || 0);
    }, 0);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen w-screen">
      <div className="px-6 py-4 flex-shrink-0">
      <h1 className="text-3xl font-bold mb-6 text-primary">Sales Records (Spreadsheet)</h1>

      {/* Date Selector & Variety Filter */}
      <div className="mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-2">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-medium mb-1">Selected Items</label>
          <div className="flex flex-wrap gap-1 bg-white border border-gray-300 rounded p-2 min-h-[32px]">
            {selectedVarietyIds.length === 0 ? (
              <span className="text-xs text-gray-500">No items selected</span>
            ) : (
              selectedVarietyIds.map(id => {
                const variety = varieties.find(v => v.id === id);
                return (
                  <button
                    key={id}
                    onClick={() => handleVarietyToggle(id)}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-1 whitespace-nowrap"
                  >
                    {variety?.name}
                    <span className="font-bold">×</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        {saving && <span className="text-sm text-blue-600 font-medium">Auto-saving...</span>}
      </div>
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 overflow-y-auto w-full">
      <div className="bg-white shadow w-full">
        <table className="w-full border-collapse">
          {/* Header - Available Stock */}
          <thead className="sticky top-0 z-30">
            <tr className="bg-blue-50 border-b-2 border-blue-200">
              <th className="px-4 py-3 text-left font-semibold text-sm bg-blue-100 sticky left-0 z-30 min-w-[200px]">Customer</th>
              <th className="px-4 py-3 text-center font-semibold text-sm bg-blue-100 sticky left-[200px] z-30 min-w-[120px]">Total Boxes</th>
              {columnOrder.map((col, idx) => {
                const available = getTotalPurchases(col.varietyId);
                return (
                  <th
                    key={col.varietyId}
                    draggable
                    onDragStart={() => handleColumnDragStart(idx)}
                    onDragOver={handleColumnDragOver}
                    onDrop={() => handleColumnDrop(idx)}
                    className="px-4 py-3 text-center font-semibold text-xs bg-blue-100 border-r border-blue-200 cursor-move hover:bg-blue-200 transition"
                  >
                    <div className="font-bold text-sm">{col.varietyName}</div>
                    <div className="text-xs text-blue-700">
                      Available: {available.crates}cr / {available.kg.toFixed(2)}kg
                    </div>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-center font-semibold text-sm bg-blue-100">Action</th>
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 bg-gray-50 sticky left-0 z-10 min-w-[200px]">
                  <select
                    value={row.customerId || ''}
                    onChange={(e) => handleCustomerChange(rowIndex, e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 bg-gray-50 sticky left-[200px] z-10 min-w-[120px] text-center font-semibold text-blue-600">
                  {row.customerId ? getTotalBoxesByCustomer(row.customerId) : '-'} boxes
                </td>

                {columnOrder.map((col) => {
                  const item = row.items[col.varietyId] || { crates: 0, kg: 0 };
                  return (
                    <td key={col.varietyId} className="px-4 py-3 border-r border-gray-200">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Cr"
                          value={item.crates || ''}
                          onChange={(e) => handleCellChange(rowIndex, col.varietyId, 'crates', e.target.value)}
                          onBlur={() => handleCellBlur(rowIndex, col.varietyId)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          min="0"
                          disabled={!row.customerId}
                        />
                        <input
                          type="number"
                          placeholder="Kg"
                          value={item.kg || ''}
                          onChange={(e) => handleCellChange(rowIndex, col.varietyId, 'kg', e.target.value)}
                          onBlur={() => handleCellBlur(rowIndex, col.varietyId)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          step="0.1"
                          min="0"
                          disabled={!row.customerId}
                        />
                      </div>
                    </td>
                  );
                })}

                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleDeleteRow(rowIndex)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Footer - Total Sold */}
          <tfoot className="sticky bottom-0 z-30">
            <tr className="bg-green-50 border-t-2 border-green-200 font-semibold">
              <td className="px-4 py-3 bg-green-100 text-sm sticky left-0 z-30 min-w-[200px]">Total Sold</td>
              <td className="px-4 py-3 bg-green-100 text-sm sticky left-[200px] z-30 min-w-[120px]"></td>
              {columnOrder.map((col) => {
                const total = getTotalSold(col.varietyId);
                const available = getAvailableStock(col.varietyId);
                const isNegative = available.crates < 0 || available.kg < 0;
                return (
                  <td key={col.varietyId} className={`px-4 py-3 text-center text-sm border-r border-green-200 ${isNegative ? 'bg-red-50' : 'bg-green-50'}`}>
                    <div className={`font-semibold text-base ${isNegative ? 'text-red-700' : 'text-green-700'}`}>
                      {available.crates}cr / {available.kg.toFixed(2)}kg
                    </div>
                    <div className="text-xs text-gray-500">
                      Sold: {total.crates}cr / {total.kg.toFixed(2)}kg
                    </div>
                  </td>
                );
              })}
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Row Button */}
      <div className="px-6 py-4 flex-shrink-0 bg-white border-t">
        <button
          onClick={handleAddRow}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + Add Row
        </button>
      </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
