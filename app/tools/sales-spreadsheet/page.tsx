'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFishVarieties, getPurchasesByDate, getSalesByDate, addSale, deleteSale, updateSale, getCustomers, cleanupDuplicateSales } from '@/app/actions/stock';
import type { FishVariety, Customer } from '@/app/actions/stock';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Hardcoded order for fish varieties
const VARIETY_ORDER = ['Pangasius', 'Roopchand', 'Rohu', 'Katla', 'Tilapia', 'Silver Carp', 'Grass Carp', 'Common Carp'];
const SIZE_ORDER = ['Big', 'Medium', 'Small'];

// Fixed colors for each variety (base colors)
const VARIETY_COLORS: { [key: string]: string } = {
  'Pangasius': '#3B82F6', // Blue
  'Roopchand': '#EF4444', // Red
  'Rohu': '#10B981', // Green
  'Katla': '#F59E0B', // Amber
  'Tilapia': '#8B5CF6', // Purple
  'Silver Carp': '#06B6D4', // Cyan
  'Grass Carp': '#EC4899', // Pink
  'Common Carp': '#6366F1', // Indigo
};

// Size shade multipliers (lighter for Big, darker for Small)
const SIZE_SHADES = {
  'Big': 0.7,      // Lighter
  'Medium': 1,     // Original
  'Small': 1.3,    // Darker
};

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Spreadsheet state
  const [rows, setRows] = useState<SaleRow[]>([{ customerId: null, items: {} }]);
  const [columnOrder, setColumnOrder] = useState<ColumnConfig[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  
  // Selected varieties for display
  const [selectedVarietyIds, setSelectedVarietyIds] = useState<number[]>([]);

  // Helper function to get color for a variety
  const getVarietyColor = (varietyName: string): string => {
    for (const [variety, color] of Object.entries(VARIETY_COLORS)) {
      if (varietyName.toLowerCase().includes(variety.toLowerCase())) {
        return color;
      }
    }
    return '#6B7280'; // Default gray
  };

  // Helper function to adjust color brightness based on size
  const adjustColorBrightness = (hex: string, factor: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.floor((num >> 16) * factor));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) * factor));
    const b = Math.min(255, Math.floor((num & 0x0000FF) * factor));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  // Get color based on variety and size
  const getColumnColor = (varietyName: string): string => {
    const baseColor = getVarietyColor(varietyName);
    let sizeShade = 1;
    
    for (const [size, shade] of Object.entries(SIZE_SHADES)) {
      if (varietyName.includes(size)) {
        sizeShade = shade;
        break;
      }
    }
    
    return adjustColorBrightness(baseColor, sizeShade);
  };

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

    // First, cleanup any duplicate sales for this date
    const cleanup = await cleanupDuplicateSales(date);
    if (cleanup.deleted > 0) {
      console.log(`Cleaned up ${cleanup.deleted} duplicate sales records`);
    }

    const [varietiesData, customersData, purchasesData, salesData] = await Promise.all([
      getFishVarieties(),
      getCustomers(),
      getPurchasesByDate(date),
      getSalesByDate(date),
    ]);

    setVarieties(varietiesData);
    setCustomers(customersData);
    setPurchases(purchasesData);

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
    loadExistingSales(salesData);
    setLoading(false);
  };

  const loadExistingSales = (salesData: any[]) => {
    if (salesData.length === 0) {
      setRows([{ customerId: null, items: {} }]);
      return;
    }

    // Group sales by customer_id and fish_variety_id
    // Each combination should have only ONE sale record (the latest one)
    const grouped: { [customerId: number]: { [varietyId: number]: any } } = {};

    salesData.forEach((sale) => {
      if (!grouped[sale.customer_id]) grouped[sale.customer_id] = {};

      // If there's already a sale for this customer+variety, keep the one with higher ID (most recent)
      // This handles legacy data with duplicates - we use the latest record
      const existing = grouped[sale.customer_id][sale.fish_variety_id];
      if (!existing || sale.id > existing.id) {
        grouped[sale.customer_id][sale.fish_variety_id] = sale;
      }
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
          (acc, [varietyId, sale]) => {
            return {
              ...acc,
              [parseInt(varietyId)]: {
                crates: sale.quantity_crates,
                kg: sale.quantity_kg,
                saleId: sale.id,
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

  // Calculate available stock for a variety (purchases - UI rows, for footer)
  // Using rows (UI state) instead of sales (DB state) for consistency with what user sees
  const getAvailableStock = (varietyId: number) => {
    // Sum purchases for this variety on selected date
    const totalPurchased = purchases.reduce(
      (sum, p) => p.fish_variety_id === varietyId ? { crates: sum.crates + p.quantity_crates, kg: sum.kg + p.quantity_kg } : sum,
      { crates: 0, kg: 0 }
    );

    // Sum sales from UI rows (what user sees) - this ensures consistency
    const totalSoldFromUI = rows.reduce(
      (sum, row) => {
        const item = row.items[varietyId];
        return item ? { crates: sum.crates + item.crates, kg: sum.kg + item.kg } : sum;
      },
      { crates: 0, kg: 0 }
    );

    return {
      crates: totalPurchased.crates - totalSoldFromUI.crates,
      kg: totalPurchased.kg - totalSoldFromUI.kg,
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
      // Parse and validate - ensure non-negative values
      let numValue = parseFloat(value) || 0;
      if (numValue < 0) numValue = 0;

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
      // Get current row from state directly
      const row = rows[rowIndex];
      if (row) {
        await saveCell(rowIndex, varietyId, row);
      }
    },
    [rows, date]
  );

  const saveCell = async (rowIndex: number, varietyId: number, row: SaleRow) => {
    if (!row.customerId) return;

    const item = row.items[varietyId];
    if (!item || (item.crates === 0 && item.kg === 0)) {
      if (item?.saleId) {
        await deleteSale(item.saleId);
        // Update local state using functional update
        setRows(prevRows => {
          const newRows = [...prevRows];
          if (newRows[rowIndex]?.items[varietyId]) {
            delete newRows[rowIndex].items[varietyId];
          }
          return newRows;
        });
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
          // Update local state using functional update
          setRows(prevRows => {
            const newRows = [...prevRows];
            if (newRows[rowIndex]?.items[varietyId]) {
              newRows[rowIndex].items[varietyId].saleId = result.id;
            }
            return newRows;
          });
        }
      }
    } catch (err) {
      console.error('Error saving sale:', err);
      alert('Failed to save sale');
    }
    setSaving(false);
  };

  const handleCustomerChange = async (rowIndex: number, newCustomerId: number | null) => {
    const oldRow = rows[rowIndex];
    const oldCustomerId = oldRow.customerId;

    // If customer is changing and there were existing sales, delete them
    if (oldCustomerId && oldCustomerId !== newCustomerId) {
      const hasExistingSales = Object.values(oldRow.items).some(item => item.saleId);
      if (hasExistingSales) {
        const confirmChange = window.confirm(
          'Changing customer will delete all sales data for this row. Continue?'
        );
        if (!confirmChange) return;

        // Delete all existing sales for this row
        for (const item of Object.values(oldRow.items)) {
          if (item.saleId) {
            await deleteSale(item.saleId);
          }
        }
      }
    }

    // Update the row with new customer and clear items if customer changed
    const newRows = [...rows];
    if (oldCustomerId && oldCustomerId !== newCustomerId) {
      newRows[rowIndex] = { customerId: newCustomerId, items: {} };
    } else {
      newRows[rowIndex].customerId = newCustomerId;
    }
    setRows(newRows);
  };

  const handleAddRow = () => {
    setRows([...rows, { customerId: null, items: {} }]);
    // Scroll to bottom after state update
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTo({
          top: tableContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 50);
  };

  const handleDeleteRow = async (rowIndex: number) => {
    const row = rows[rowIndex];
    const hasExistingSales = Object.values(row.items).some(item => item.saleId);

    // Confirm deletion if there are saved sales
    if (hasExistingSales) {
      const confirmDelete = window.confirm(
        'This will permanently delete all sales data for this customer. Continue?'
      );
      if (!confirmDelete) return;
    }

    // Delete all sales in this row
    for (const item of Object.values(row.items)) {
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
      <div className="flex flex-col h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header Section */}
      <div className="px-6 py-5 flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sales Spreadsheet</h1>
              <p className="text-sm text-gray-500">Quick entry for daily sales records</p>
            </div>
          </div>
          {saving && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-blue-600 font-medium">Saving...</span>
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-6">
          {/* Date Picker */}
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
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="ml-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm font-semibold transition-colors shadow-sm"
                title="Go to today"
              >
                Today
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-300"></div>

          {/* Selected Fish Varieties */}
          <div className="flex items-center gap-3 flex-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
              Fish Varieties
              <span className="ml-1 text-gray-400 font-normal normal-case">({selectedVarietyIds.length})</span>
            </label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {selectedVarietyIds.length === 0 ? (
                <span className="text-sm text-gray-400 italic">No varieties selected</span>
              ) : (
                selectedVarietyIds.map(id => {
                  const variety = varieties.find(v => v.id === id);
                  const columnColor = getColumnColor(variety?.name || '');
                  return (
                    <button
                      key={id}
                      onClick={() => handleVarietyToggle(id)}
                      style={{
                        backgroundColor: columnColor,
                        boxShadow: `0 1px 4px ${columnColor}30`
                      }}
                      className="group px-2.5 py-1 text-xs text-white rounded-md hover:opacity-90 transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap font-medium"
                    >
                      {variety?.name}
                      <span className="opacity-70 group-hover:opacity-100 transition-opacity">×</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Container */}
      <div ref={tableContainerRef} className="flex-1 overflow-auto w-full relative">
        {/* Right scroll shadow indicator */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/10 to-transparent z-40" />
      <div className="bg-white shadow min-w-max">
        <table className="w-full border-collapse">
          {/* Header - Available Stock */}
          <thead className="sticky top-0 z-30">
            <tr className="bg-gradient-to-r from-slate-700 to-slate-600 border-b-4 border-blue-500">
              <th className="px-4 py-2.5 text-left font-bold text-sm text-white bg-slate-700 sticky left-0 z-30 min-w-[200px] border-r-2 border-blue-400">Customer</th>
              <th className="px-3 py-2.5 text-center font-bold text-sm text-white bg-slate-700 sticky left-[200px] z-30 min-w-[120px] border-r-2 border-blue-400">Total</th>
              {columnOrder.map((col, idx) => {
                const purchased = getTotalPurchases(col.varietyId);
                const columnColor = getColumnColor(col.varietyName);
                return (
                  <th
                    key={col.varietyId}
                    draggable
                    onDragStart={() => handleColumnDragStart(idx)}
                    onDragOver={handleColumnDragOver}
                    onDrop={() => handleColumnDrop(idx)}
                    style={{ backgroundColor: columnColor }}
                    className="px-2 py-2.5 text-center font-bold text-sm text-white border-r-2 border-white cursor-move hover:opacity-90 hover:shadow-lg transition min-w-[120px] shadow-md"
                  >
                    <div className="font-bold text-sm leading-tight">{col.varietyName}</div>
                    <div className="text-xs opacity-85 mt-1 font-bold bg-black/20 rounded py-0.5 px-1">
                      {purchased.crates}cr in stock
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-center font-bold text-sm bg-slate-700 text-white">Action</th>
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody>
            {rows.map((row, rowIndex) => {
              const isEmptyRow = !row.customerId;
              return (
              <tr key={rowIndex} className={`border-b transition-all duration-150 group ${isEmptyRow ? 'bg-amber-50/50' : 'hover:bg-blue-50/50'}`}>
                <td className={`px-4 py-2 sticky left-0 z-10 min-w-[200px] border-r-2 transition-colors ${isEmptyRow ? 'bg-gradient-to-r from-amber-100 to-amber-50 border-amber-300' : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 group-hover:from-blue-100 group-hover:to-blue-50'}`}>
                  <select
                    value={row.customerId || ''}
                    onChange={(e) => handleCustomerChange(rowIndex, e.target.value ? parseInt(e.target.value) : null)}
                    className={`w-full px-3 py-2 border-2 rounded-lg text-sm font-semibold bg-white transition-all appearance-none cursor-pointer ${isEmptyRow ? 'border-amber-400 text-amber-700 hover:border-amber-500 focus:border-amber-500 focus:ring-amber-200' : 'border-blue-300 text-gray-800 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-200'} focus:outline-none focus:ring-2`}
                  >
                    <option value="" className="text-gray-500">{isEmptyRow ? '+ Select Customer to Add Row' : 'Select Customer'}</option>
                    {customers.map((c) => {
                      const isUsedInOtherRow = rows.some((r, idx) => idx !== rowIndex && r.customerId === c.id);
                      return (
                        <option
                          key={c.id}
                          value={c.id}
                          className="font-medium"
                          disabled={isUsedInOtherRow}
                        >
                          {c.name}{isUsedInOtherRow ? ' (already selected)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </td>
                <td className={`px-3 py-2 sticky left-[200px] z-10 min-w-[120px] text-center border-r-2 transition-colors ${isEmptyRow ? 'bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-300' : 'bg-gradient-to-r from-blue-100 to-blue-50 border-blue-200 group-hover:from-blue-50 group-hover:to-blue-100'}`}>
                  {row.customerId ? (
                    <>
                      <div className="text-2xl font-bold text-blue-700">
                        {getTotalBoxesByCustomer(row.customerId)}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">boxes</div>
                    </>
                  ) : (
                    <div className="text-sm text-amber-600 font-medium">—</div>
                  )}
                </td>

                {columnOrder.map((col) => {
                  const item = row.items[col.varietyId] || { crates: 0, kg: 0 };
                  const hasValue = item.crates > 0 || item.kg > 0;
                  const columnColor = getColumnColor(col.varietyName);
                  return (
                    <td key={col.varietyId} className={`px-2 py-2 border-r border-gray-200 transition-colors ${!row.customerId ? 'bg-gray-50/50' : hasValue ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <div className="flex gap-1 items-center justify-center">
                        <input
                          type="number"
                          placeholder="0"
                          value={item.crates || ''}
                          onChange={(e) => handleCellChange(rowIndex, col.varietyId, 'crates', e.target.value)}
                          onBlur={() => handleCellBlur(rowIndex, col.varietyId)}
                          style={hasValue ? { borderColor: columnColor, backgroundColor: `${columnColor}10` } : {}}
                          className={`w-16 px-2 py-1.5 border-2 rounded-md text-sm text-center font-semibold transition-all ${hasValue ? 'text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400'} hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-40 disabled:cursor-not-allowed`}
                          min="0"
                          disabled={!row.customerId}
                          title="Crates"
                        />
                        <span className={`text-xs font-medium min-w-[16px] ${hasValue ? 'text-gray-600' : 'text-gray-400'}`}>cr</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={item.kg || ''}
                          onChange={(e) => handleCellChange(rowIndex, col.varietyId, 'kg', e.target.value)}
                          onBlur={() => handleCellBlur(rowIndex, col.varietyId)}
                          className={`w-14 px-2 py-1.5 border rounded-md text-sm text-center transition-all ${item.kg > 0 ? 'border-gray-400 text-gray-700' : 'border-gray-200 text-gray-400'} hover:border-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-40 disabled:cursor-not-allowed`}
                          step="0.1"
                          min="0"
                          disabled={!row.customerId}
                          title="Kg"
                        />
                        <span className={`text-xs font-medium min-w-[16px] ${item.kg > 0 ? 'text-gray-600' : 'text-gray-400'}`}>kg</span>
                      </div>
                    </td>
                  );
                })}

                <td className="px-4 py-3 text-center bg-white group-hover:bg-gray-50">
                  <button
                    onClick={() => handleDeleteRow(rowIndex)}
                    className="px-3 py-1.5 text-sm bg-red-50 text-red-500 rounded-md hover:bg-red-100 hover:text-red-600 transition-colors font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )})}
          </tbody>

          {/* Footer - Total Sold */}
          <tfoot className="sticky bottom-0 z-30">
            <tr className="bg-gradient-to-r from-emerald-50 to-green-50 border-t-4 border-green-400 font-semibold">
              <td className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-emerald-50 text-sm sticky left-0 z-30 min-w-[200px] font-bold text-emerald-900 border-r-2 border-emerald-200">Totals</td>
              <td className="px-3 py-2 bg-gradient-to-r from-emerald-100 to-emerald-50 text-sm sticky left-[200px] z-30 min-w-[120px] border-r-2 border-emerald-200"></td>
              {columnOrder.map((col) => {
                const total = getTotalSold(col.varietyId);
                const available = getAvailableStock(col.varietyId);
                const isNegative = available.crates < 0 || available.kg < 0;
                return (
                  <td key={col.varietyId} className={`px-1.5 py-2 text-center border-r font-semibold transition-all ${isNegative ? 'bg-red-100 border-red-200' : 'bg-emerald-100 border-emerald-200'}`}>
                    <div className={`text-xs font-bold mb-0.5 ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>Available</div>
                    <div className={`text-base font-bold ${isNegative ? 'text-red-700' : 'text-emerald-700'}`}>
                      {available.crates}cr
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${isNegative ? 'text-red-500' : 'text-emerald-600'}`}>Sold: {total.crates}cr</div>
                  </td>
                );
              })}
            
              <td className="px-2 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>


      </div>
            {/* Add Row Button - Fixed at bottom */}
      <div className="flex-shrink-0 px-6 py-3 bg-white border-t border-gray-200 flex gap-3">
        <button
          onClick={handleAddRow}
          className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-sm"
        >
          + Add Row
        </button>
      </div>
    </div>
    </ProtectedRoute>
  );
}
