'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFishVarieties, getPurchasesByDate, getSalesByDate, addSale, deleteSale, updateSale, getCustomers, cleanupDuplicateSales } from '@/app/actions/stock';
import type { FishVariety, Customer } from '@/app/actions/stock';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getLastRatesForVarieties, createBill, updateBill, getNextBillNumber, getCustomerPendingBalance, getBillForCustomerOnDate, type BillItem, type Bill } from '@/app/actions/bills';

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

  // Bill modal state
  const [showBillModal, setShowBillModal] = useState(false);
  const [billCustomerId, setBillCustomerId] = useState<number | null>(null);
  const [billItems, setBillItems] = useState<{
    varietyId: number;
    varietyName: string;
    crates: number;
    kgPerCrate: number;
    totalKg: number;
    ratePerKg: number;
  }[]>([]);
  const [additionalCharges, setAdditionalCharges] = useState<{ label: string; amount: number }[]>([]);
  const [billNotes, setBillNotes] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [generatingBill, setGeneratingBill] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [savedBill, setSavedBill] = useState<any>(null);
  const [previousBalance, setPreviousBalance] = useState(0);
  const [amountReceived, setAmountReceived] = useState(0);
  const billPreviewRef = useRef<HTMLDivElement>(null);
  const DEFAULT_KG_PER_CRATE = 35;

  // Track existing bills for customers on this date
  const [customerBills, setCustomerBills] = useState<{[customerId: number]: Bill}>({});
  const [viewingExistingBill, setViewingExistingBill] = useState(false);

  // Helper function to parse additional charges from notes
  const parseAdditionalChargesFromNotes = (notes: string | undefined): { label: string; amount: number }[] => {
    if (!notes) return [];

    // Look for "Additional: " pattern
    const additionalMatch = notes.match(/Additional:\s*(.+?)(?:\||$)/);
    if (!additionalMatch) return [];

    const chargesText = additionalMatch[1].trim();
    const charges: { label: string; amount: number }[] = [];

    // Split by comma and parse each charge
    const chargeParts = chargesText.split(',');
    for (const part of chargeParts) {
      const match = part.trim().match(/^(.+?):\s*₹?(\d+)$/);
      if (match) {
        charges.push({
          label: match[1].trim(),
          amount: parseInt(match[2])
        });
      }
    }

    return charges;
  };

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

  const loadExistingSales = useCallback((salesData: any[]) => {
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
  }, []);

  const loadExistingBills = useCallback(async (salesData: any[]) => {
    // Get unique customer IDs from sales
    const customerIds = [...new Set(salesData.map(s => s.customer_id))];

    // Check for existing bills for each customer
    const bills: {[customerId: number]: Bill} = {};

    await Promise.all(
      customerIds.map(async (customerId) => {
        const existingBill = await getBillForCustomerOnDate(customerId, date);
        if (existingBill) {
          bills[customerId] = existingBill;
        }
      })
    );

    setCustomerBills(bills);
  }, [date]);

  const loadData = useCallback(async () => {
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

    // Load existing bills for customers on this date
    await loadExistingBills(salesData);

    setLoading(false);
  }, [date, loadExistingSales, loadExistingBills]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      await loadData();
      if (cancelled) return;
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  // Sync columnOrder whenever selectedVarietyIds changes
  useEffect(() => {
    const newOrder = selectedVarietyIds.map(id => {
      const v = varieties.find(vv => vv.id === id);
      return { varietyId: id, varietyName: v?.name || '' };
    });
    setColumnOrder(newOrder);
  }, [selectedVarietyIds, varieties]);

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

  // Check if sales data differs from bill data
  const hasSalesChangedSinceBill = (customerId: number): boolean => {
    const bill = customerBills[customerId];
    if (!bill) return false;

    const row = rows.find(r => r.customerId === customerId);
    if (!row) return true;

    // Get current sales items
    const currentItems = Object.entries(row.items)
      .filter(([_, item]) => item.crates > 0 || item.kg > 0)
      .map(([varietyId, item]) => ({
        varietyId: parseInt(varietyId),
        crates: item.crates,
        kg: item.kg,
      }));

    // Compare with bill items
    const billItems = bill.items || [];

    // Different number of items
    if (currentItems.length !== billItems.length) return true;

    // Check each item
    for (const current of currentItems) {
      const billItem = billItems.find(bi => bi.fish_variety_id === current.varietyId);
      if (!billItem) return true;

      // Calculate total kg from current sales (crates * 35 + kg)
      const currentTotalKg = (current.crates * DEFAULT_KG_PER_CRATE) + current.kg;

      // Compare quantities (allow small floating point differences)
      if (Math.abs(currentTotalKg - billItem.quantity_kg) > 0.1) return true;
      if (current.crates !== billItem.quantity_crates) return true;
    }

    return false;
  };

  // Generate Bill handlers
  const openBillModal = async (customerId: number) => {
    const row = rows.find(r => r.customerId === customerId);
    if (!row) return;

    // Check if bill already exists for this customer on this date
    const existingBill = customerBills[customerId];
    const isUpdating = !!existingBill;

    // Get items with quantity > 0
    const itemsWithQuantity = Object.entries(row.items)
      .filter(([_, item]) => item.crates > 0 || item.kg > 0)
      .map(([varietyId, item]) => {
        const variety = varieties.find(v => v.id === parseInt(varietyId));
        const totalKg = (item.crates * DEFAULT_KG_PER_CRATE) + item.kg;
        // If updating, try to keep existing rates from the bill
        const existingBillItem = existingBill?.items?.find(bi => bi.fish_variety_id === parseInt(varietyId));
        return {
          varietyId: parseInt(varietyId),
          varietyName: variety?.name || '',
          crates: item.crates,
          kgPerCrate: DEFAULT_KG_PER_CRATE,
          totalKg: totalKg,
          ratePerKg: existingBillItem?.rate_per_kg || 0,
        };
      });

    if (itemsWithQuantity.length === 0) {
      alert('No items to bill for this customer');
      return;
    }

    // Get last rates for varieties that don't have rates yet
    const varietyIds = itemsWithQuantity.filter(i => i.ratePerKg === 0).map(i => i.varietyId);
    if (varietyIds.length > 0) {
      const lastRates = await getLastRatesForVarieties(varietyIds);
      itemsWithQuantity.forEach(item => {
        if (item.ratePerKg === 0 && lastRates[item.varietyId]) {
          item.ratePerKg = lastRates[item.varietyId].rate_per_kg || 0;
        }
      });
    }

    // Get bill number and previous balance
    let billNum: string;
    let pendingBalance: number;

    if (isUpdating) {
      // Keep existing bill number, calculate balance EXCLUDING current bill
      billNum = existingBill.bill_number;
      pendingBalance = await getCustomerPendingBalance(customerId, existingBill.id);
    } else {
      // New bill - calculate from all unpaid bills
      [billNum, pendingBalance] = await Promise.all([
        getNextBillNumber(),
        getCustomerPendingBalance(customerId),
      ]);
    }

    setBillCustomerId(customerId);
    setBillItems(itemsWithQuantity);
    setBillNumber(billNum);
    setAdditionalCharges(isUpdating ? parseAdditionalChargesFromNotes(existingBill?.notes) : []);
    setBillNotes(existingBill?.notes || '');
    setPreviousBalance(pendingBalance);
    setAmountReceived(isUpdating ? ((existingBill as any).amount_received || 0) : 0);
    setShowBillModal(true);
    setShowBillPreview(false);
    setSavedBill(isUpdating ? existingBill : null);
    setViewingExistingBill(isUpdating);
  };

  // View existing bill
  const viewExistingBill = (customerId: number) => {
    const existingBill = customerBills[customerId];
    if (!existingBill) return;

    // Convert bill items to display format
    const items = existingBill.items.map(item => ({
      varietyId: item.fish_variety_id,
      varietyName: item.fish_variety_name,
      crates: item.quantity_crates,
      kgPerCrate: item.quantity_kg > 0 && item.quantity_crates > 0
        ? Math.round(item.quantity_kg / item.quantity_crates)
        : DEFAULT_KG_PER_CRATE,
      totalKg: item.quantity_kg,
      ratePerKg: item.rate_per_kg,
    }));

    setBillCustomerId(customerId);
    setBillItems(items);
    setBillNumber(existingBill.bill_number);
    setAdditionalCharges(parseAdditionalChargesFromNotes(existingBill.notes));
    setBillNotes(existingBill.notes || '');
    setPreviousBalance((existingBill as any).previous_balance || 0);
    setAmountReceived((existingBill as any).amount_received || 0);
    setSavedBill(existingBill);
    setShowBillPreview(true);
    setShowBillModal(true);
    setViewingExistingBill(true);
  };

  // Edit existing bill - switch to edit mode
  const handleEditBill = async () => {
    if (!billCustomerId || !customerBills[billCustomerId]) return;

    const existingBill = customerBills[billCustomerId];

    // Get current sales data for this customer
    const row = rows.find(r => r.customerId === billCustomerId);
    if (!row) return;

    // Rebuild items from current sales data
    const itemsWithQuantity = Object.entries(row.items)
      .filter(([_, item]) => item.crates > 0 || item.kg > 0)
      .map(([varietyId, item]) => {
        const variety = varieties.find(v => v.id === parseInt(varietyId));
        // Keep existing rate from bill if available
        const existingItem = billItems.find(bi => bi.varietyId === parseInt(varietyId));
        const totalKg = (item.crates * DEFAULT_KG_PER_CRATE) + item.kg;
        return {
          varietyId: parseInt(varietyId),
          varietyName: variety?.name || '',
          crates: item.crates,
          kgPerCrate: DEFAULT_KG_PER_CRATE,
          totalKg: totalKg,
          ratePerKg: existingItem?.ratePerKg || 0,
        };
      });

    // Calculate previous balance from other unpaid bills, EXCLUDING current bill
    const pendingBalance = await getCustomerPendingBalance(billCustomerId, existingBill.id);

    setBillItems(itemsWithQuantity);
    setPreviousBalance(pendingBalance);
    setShowBillPreview(false);
    setViewingExistingBill(true); // Keep this true so we know to update, not create
  };

  // Save updated bill
  const handleUpdateBill = async () => {
    if (!billCustomerId || !customerBills[billCustomerId]) return;

    // Validate rates
    const hasZeroRate = billItems.some(item => item.totalKg > 0 && item.ratePerKg === 0);
    if (hasZeroRate) {
      alert('Please enter rates for all items');
      return;
    }

    setGeneratingBill(true);

    const existingBill = customerBills[billCustomerId];

    const itemsForBill: Omit<BillItem, 'amount'>[] = billItems.map(item => ({
      fish_variety_id: item.varietyId,
      fish_variety_name: item.varietyName,
      quantity_crates: item.crates,
      quantity_kg: item.totalKg,
      rate_per_crate: 0,
      rate_per_kg: item.ratePerKg,
    }));

    // Include additional charges in notes
    let notesWithCharges = billNotes || '';
    if (additionalCharges.length > 0) {
      const chargesText = additionalCharges
        .filter(c => c.label && c.amount)
        .map(c => `${c.label}: ₹${c.amount}`)
        .join(', ');
      if (chargesText) {
        notesWithCharges = notesWithCharges ? `${notesWithCharges} | Additional: ${chargesText}` : `Additional: ${chargesText}`;
      }
    }

    const updatedBill = await updateBill(
      existingBill.id,
      itemsForBill,
      0, // No discount
      notesWithCharges || undefined,
      previousBalance,
      amountReceived
    );

    setGeneratingBill(false);

    if (updatedBill) {
      // Keep the original bill number
      updatedBill.bill_number = existingBill.bill_number;
      setSavedBill(updatedBill);
      setShowBillPreview(true);
      // Update tracked bills
      setCustomerBills(prev => ({ ...prev, [billCustomerId]: updatedBill }));
    } else {
      alert('Failed to update bill');
    }
  };

  const updateBillItemKgPerCrate = (index: number, value: number) => {
    const newItems = [...billItems];
    newItems[index].kgPerCrate = value;
    newItems[index].totalKg = newItems[index].crates * value;
    setBillItems(newItems);
  };

  const updateBillItemRate = (index: number, value: number) => {
    const newItems = [...billItems];
    newItems[index].ratePerKg = value;
    setBillItems(newItems);
  };

  const addAdditionalCharge = () => {
    setAdditionalCharges([...additionalCharges, { label: '', amount: 0 }]);
  };

  const updateAdditionalCharge = (index: number, field: 'label' | 'amount', value: string | number) => {
    const newCharges = [...additionalCharges];
    if (field === 'label') {
      newCharges[index].label = value as string;
    } else {
      newCharges[index].amount = value as number;
    }
    setAdditionalCharges(newCharges);
  };

  const removeAdditionalCharge = (index: number) => {
    setAdditionalCharges(additionalCharges.filter((_, i) => i !== index));
  };

  const getBillSubtotal = () => {
    return billItems.reduce((sum, item) => {
      return sum + (item.totalKg * item.ratePerKg);
    }, 0);
  };

  const getAdditionalTotal = () => {
    return additionalCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
  };

  const getBillTotal = () => {
    return getBillSubtotal() + getAdditionalTotal();
  };

  const getGrandTotal = () => {
    return getBillTotal() + previousBalance;
  };

  const getBalanceDue = () => {
    return getGrandTotal() - amountReceived;
  };

  const handleSaveBill = async () => {
    if (!billCustomerId) return;

    // Validate rates
    const hasZeroRate = billItems.some(item => item.totalKg > 0 && item.ratePerKg === 0);

    if (hasZeroRate) {
      alert('Please enter rates for all items');
      return;
    }

    setGeneratingBill(true);

    // IMPORTANT: Check again if bill already exists to prevent duplicates
    const existingBill = await getBillForCustomerOnDate(billCustomerId, date);
    if (existingBill) {
      // Bill already exists - update instead of create
      setViewingExistingBill(true);
      setCustomerBills(prev => ({ ...prev, [billCustomerId]: existingBill }));
      setBillNumber(existingBill.bill_number);

      const itemsForBill: Omit<BillItem, 'amount'>[] = billItems.map(item => ({
        fish_variety_id: item.varietyId,
        fish_variety_name: item.varietyName,
        quantity_crates: item.crates,
        quantity_kg: item.totalKg,
        rate_per_crate: 0,
        rate_per_kg: item.ratePerKg,
      }));

      let notesWithCharges = billNotes || '';
      if (additionalCharges.length > 0) {
        const chargesText = additionalCharges
          .filter(c => c.label && c.amount)
          .map(c => `${c.label}: ₹${c.amount}`)
          .join(', ');
        if (chargesText) {
          notesWithCharges = notesWithCharges ? `${notesWithCharges} | Additional: ${chargesText}` : `Additional: ${chargesText}`;
        }
      }

      const updatedBill = await updateBill(
        existingBill.id,
        itemsForBill,
        0,
        notesWithCharges || undefined,
        previousBalance,
        amountReceived
      );

      setGeneratingBill(false);

      if (updatedBill) {
        updatedBill.bill_number = existingBill.bill_number;
        setSavedBill(updatedBill);
        setShowBillPreview(true);
        setCustomerBills(prev => ({ ...prev, [billCustomerId]: updatedBill }));
      } else {
        alert('Failed to update bill');
      }
      return;
    }

    const itemsForBill: Omit<BillItem, 'amount'>[] = billItems.map(item => ({
      fish_variety_id: item.varietyId,
      fish_variety_name: item.varietyName,
      quantity_crates: item.crates,
      quantity_kg: item.totalKg,
      rate_per_crate: 0,
      rate_per_kg: item.ratePerKg,
    }));

    // Include additional charges in notes for now
    let notesWithCharges = billNotes || '';
    if (additionalCharges.length > 0) {
      const chargesText = additionalCharges
        .filter(c => c.label && c.amount)
        .map(c => `${c.label}: ₹${c.amount}`)
        .join(', ');
      if (chargesText) {
        notesWithCharges = notesWithCharges ? `${notesWithCharges} | Additional: ${chargesText}` : `Additional: ${chargesText}`;
      }
    }

    const bill = await createBill(
      billCustomerId,
      date,
      itemsForBill,
      0, // No discount
      notesWithCharges || undefined,
      previousBalance,
      amountReceived
    );

    setGeneratingBill(false);

    if (bill) {
      setSavedBill(bill);
      setShowBillPreview(true);
      // Track this bill so the button changes to "View"
      setCustomerBills(prev => ({ ...prev, [billCustomerId]: bill }));
    } else {
      alert('Failed to save bill');
    }
  };

  const closeBillModal = () => {
    setShowBillModal(false);
    setBillCustomerId(null);
    setBillItems([]);
    setAdditionalCharges([]);
    setPreviousBalance(0);
    setAmountReceived(0);
    setShowBillPreview(false);
    setSavedBill(null);
    setViewingExistingBill(false);
  };

  const printBill = () => {
    if (billPreviewRef.current) {
      const printContent = billPreviewRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Bill ${savedBill?.bill_number || billNumber}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .text-lg { font-size: 1.1em; }
                .text-xl { font-size: 1.25em; }
                .mb-2 { margin-bottom: 8px; }
                .mb-4 { margin-bottom: 16px; }
                .mt-4 { margin-top: 16px; }
                .border-t { border-top: 2px solid #333; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const shareWhatsApp = () => {
    if (!savedBill) return;

    const customer = customers.find(c => c.id === billCustomerId);
    let message = `*S.K.S. Co.*\n`;
    message += `Fish Trading & Prawn Commission Agent\n`;
    message += `━━━━━━━━━━━━━━━\n`;
    message += `Bill No: *${savedBill.bill_number}*\n`;
    message += `Date: ${new Date(date).toLocaleDateString('en-IN')}\n`;
    message += `Name: *${customer?.name || 'N/A'}*\n\n`;
    message += `*Items:*\n`;

    billItems.forEach(item => {
      const amount = item.totalKg * item.ratePerKg;
      message += `${item.varietyName}: ${item.crates}cr (${item.totalKg}kg) × ₹${item.ratePerKg}/kg = ₹${amount.toLocaleString()}\n`;
    });

    message += `\n*Subtotal:* ₹${getBillSubtotal().toLocaleString()}`;

    if (additionalCharges.length > 0) {
      additionalCharges.filter(c => c.label && c.amount).forEach(charge => {
        message += `\n*${charge.label}:* ₹${charge.amount.toLocaleString()}`;
      });
    }

    message += `\n*Current Bill:* ₹${getBillTotal().toLocaleString()}`;

    if (previousBalance > 0) {
      message += `\n*Previous Balance:* ₹${previousBalance.toLocaleString()}`;
      message += `\n*Grand Total:* ₹${getGrandTotal().toLocaleString()}`;
    }

    if (amountReceived > 0) {
      message += `\n*Amount Received:* ₹${amountReceived.toLocaleString()}`;
    }

    message += `\n\n*Balance Due:* ₹${getBalanceDue().toLocaleString()}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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
      <div ref={tableContainerRef} className="flex-1 overflow-auto w-full">
      <div className="bg-white min-w-max">
        <table className="w-full border-collapse">
          {/* Header - Available Stock */}
          <thead className="sticky top-0 z-30">
            <tr className="bg-gradient-to-r from-slate-700 to-slate-600 border-b-4 border-blue-500">
              <th className="px-4 py-2.5 text-left font-bold text-sm text-white bg-slate-700 sticky left-0 z-40 min-w-[180px] shadow-[2px_0_4px_rgba(0,0,0,0.1)]">Customer</th>
              <th className="px-3 py-2.5 text-center font-bold text-sm text-white bg-slate-700 sticky left-[180px] z-40 min-w-[80px] shadow-[2px_0_4px_rgba(0,0,0,0.1)]">Total</th>
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
                    className="px-1 py-2.5 text-center font-bold text-sm text-white border-r border-white/30 cursor-move hover:opacity-90 transition min-w-[200px]"
                  >
                    <div className="font-bold text-sm leading-tight">{col.varietyName}</div>
                    <div className="text-xs opacity-85 mt-1 font-bold bg-black/20 rounded py-0.5 px-1">
                      {purchased.crates > 0 ? `${purchased.crates}cr` : ''}{purchased.crates > 0 && purchased.kg > 0 ? ' + ' : ''}{purchased.kg > 0 ? `${purchased.kg}kg` : ''}{purchased.crates === 0 && purchased.kg === 0 ? '0' : ''} in stock
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
                <td className={`px-3 py-2 sticky left-0 z-20 min-w-[180px] transition-colors shadow-[2px_0_4px_rgba(0,0,0,0.05)] ${isEmptyRow ? 'bg-amber-50' : 'bg-blue-50 group-hover:bg-blue-100'}`}>
                  <select
                    value={row.customerId || ''}
                    onChange={(e) => handleCustomerChange(rowIndex, e.target.value ? parseInt(e.target.value) : null)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-sm font-semibold bg-white transition-all appearance-none cursor-pointer ${isEmptyRow ? 'border-amber-300 text-amber-700' : 'border-blue-200 text-gray-800'} focus:outline-none focus:ring-1 focus:ring-blue-400`}
                  >
                    <option value="" className="text-gray-500">{isEmptyRow ? '+ Add Customer' : 'Select'}</option>
                    {customers.map((c) => {
                      const isUsedInOtherRow = rows.some((r, idx) => idx !== rowIndex && r.customerId === c.id);
                      return (
                        <option
                          key={c.id}
                          value={c.id}
                          className="font-medium"
                          disabled={isUsedInOtherRow}
                        >
                          {c.name}{isUsedInOtherRow ? ' (used)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </td>
                <td className={`px-2 py-2 sticky left-[180px] z-20 min-w-[80px] text-center transition-colors shadow-[2px_0_4px_rgba(0,0,0,0.05)] ${isEmptyRow ? 'bg-amber-50' : 'bg-blue-50 group-hover:bg-blue-100'}`}>
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
                  const hasCrates = item.crates > 0;
                  const hasKg = item.kg > 0;
                  const columnColor = getColumnColor(col.varietyName);
                  return (
                    <td key={col.varietyId} className={`px-1 py-1.5 border-r border-gray-200 transition-colors min-w-[200px] ${!row.customerId ? 'bg-gray-50/50' : (hasCrates || hasKg) ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <div className="flex items-center justify-center gap-2">
                        {/* Crates input */}
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            placeholder="0"
                            value={item.crates || ''}
                            onChange={(e) => handleCellChange(rowIndex, col.varietyId, 'crates', e.target.value)}
                            onBlur={() => handleCellBlur(rowIndex, col.varietyId)}
                            style={hasCrates ? { borderColor: columnColor, backgroundColor: `${columnColor}15` } : {}}
                            className={`w-14 px-1 py-1 border-2 rounded text-sm text-center font-semibold ${hasCrates ? 'text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-400'} focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40`}
                            min="0"
                            disabled={!row.customerId}
                          />
                          <span className={`text-xs font-medium ${hasCrates ? 'text-gray-700' : 'text-gray-400'}`}>cr</span>
                        </div>
                        {/* Kg input */}
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            placeholder="0"
                            value={item.kg || ''}
                            onChange={(e) => handleCellChange(rowIndex, col.varietyId, 'kg', e.target.value)}
                            onBlur={() => handleCellBlur(rowIndex, col.varietyId)}
                            style={hasKg ? { borderColor: '#6b7280', backgroundColor: '#f9fafb' } : {}}
                            className={`w-14 px-1 py-1 border rounded text-sm text-center ${hasKg ? 'border-gray-500 text-gray-700 font-semibold' : 'border-gray-200 text-gray-400'} focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-40`}
                            step="0.1"
                            min="0"
                            disabled={!row.customerId}
                          />
                          <span className={`text-xs font-medium ${hasKg ? 'text-gray-700' : 'text-gray-400'}`}>kg</span>
                        </div>
                      </div>
                    </td>
                  );
                })}

                <td className="px-3 py-3 text-center bg-white group-hover:bg-gray-50">
                  <div className="flex gap-2 justify-center">
                    {row.customerId && Object.values(row.items).some(item => item.crates > 0 || item.kg > 0) && (
                      customerBills[row.customerId] ? (
                        (() => {
                          const hasChanges = hasSalesChangedSinceBill(row.customerId!);
                          return (
                            <button
                              onClick={() => hasChanges ? openBillModal(row.customerId!) : viewExistingBill(row.customerId!)}
                              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium flex items-center gap-1 ${
                                hasChanges
                                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                              }`}
                              title={hasChanges ? 'Sales changed - click to update bill' : 'View existing bill'}
                            >
                              {hasChanges ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Update
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View
                                </>
                              )}
                            </button>
                          );
                        })()
                      ) : (
                        <button
                          onClick={() => openBillModal(row.customerId!)}
                          className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-md hover:bg-green-100 hover:text-green-700 transition-colors font-medium"
                        >
                          Bill
                        </button>
                      )
                    )}
                    <button
                      onClick={() => handleDeleteRow(rowIndex)}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-500 rounded-md hover:bg-red-100 hover:text-red-600 transition-colors font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>

          {/* Footer - Total Sold */}
          <tfoot className="sticky bottom-0 z-30">
            <tr className="bg-emerald-50 border-t-2 border-green-400 font-semibold">
              <td className="px-3 py-2 bg-emerald-100 text-sm sticky left-0 z-40 min-w-[180px] font-bold text-emerald-900 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">Totals</td>
              <td className="px-2 py-2 bg-emerald-100 text-sm sticky left-[180px] z-40 min-w-[80px] shadow-[2px_0_4px_rgba(0,0,0,0.1)]"></td>
              {columnOrder.map((col) => {
                const total = getTotalSold(col.varietyId);
                const available = getAvailableStock(col.varietyId);
                const isNegative = available.crates < 0 || available.kg < 0;
                return (
                  <td key={col.varietyId} className={`px-1.5 py-2 text-center border-r font-semibold transition-all min-w-[200px] ${isNegative ? 'bg-red-100 border-red-200' : 'bg-emerald-100 border-emerald-200'}`}>
                    <div className={`text-xs font-bold mb-0.5 ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>Available</div>
                    <div className={`text-base font-bold ${isNegative ? 'text-red-700' : 'text-emerald-700'}`}>
                      {available.crates > 0 ? `${available.crates}cr` : ''}{available.crates !== 0 && available.kg !== 0 ? ' + ' : ''}{available.kg !== 0 ? `${available.kg}kg` : ''}{available.crates === 0 && available.kg === 0 ? '0' : ''}
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${isNegative ? 'text-red-500' : 'text-emerald-600'}`}>
                      Sold: {total.crates > 0 ? `${total.crates}cr` : ''}{total.crates > 0 && total.kg > 0 ? ' + ' : ''}{total.kg > 0 ? `${total.kg}kg` : ''}{total.crates === 0 && total.kg === 0 ? '0' : ''}
                    </div>
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

      {/* Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-500 to-emerald-500">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {showBillPreview ? 'Bill Preview' : 'Generate Bill'}
                </h2>
                <p className="text-sm text-green-100">
                  {customers.find(c => c.id === billCustomerId)?.name} • {new Date(date).toLocaleDateString('en-IN')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-green-100">Bill No.</div>
                <div className="text-lg font-bold text-white">{savedBill?.bill_number || billNumber}</div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {!showBillPreview ? (
                /* Rate Entry Form */
                <div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-sm font-semibold text-gray-700 border-b">Fish Variety</th>
                        <th className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border-b">Crates</th>
                        <th className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border-b">Kg/Crate</th>
                        <th className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border-b">Total Kg</th>
                        <th className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border-b">Rate/Kg</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-gray-700 border-b">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billItems.map((item, index) => {
                        const amount = item.totalKg * item.ratePerKg;
                        return (
                          <tr key={item.varietyId} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-3 font-medium text-gray-800">{item.varietyName}</td>
                            <td className="px-3 py-3 text-center text-gray-600 font-semibold">{item.crates}</td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                value={item.kgPerCrate || ''}
                                onChange={(e) => updateBillItemKgPerCrate(index, parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1.5 border border-gray-300 rounded text-center text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                                min="0"
                              />
                            </td>
                            <td className="px-3 py-3 text-center font-semibold text-gray-700">{item.totalKg}</td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                value={item.ratePerKg || ''}
                                onChange={(e) => updateBillItemRate(index, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-20 px-2 py-1.5 border border-gray-300 rounded text-center text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                                min="0"
                              />
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-gray-800">
                              ₹{amount.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Additional Charges */}
                  <div className="mt-6 border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-700">Additional Charges</span>
                      <button
                        onClick={addAdditionalCharge}
                        className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                      >
                        <span>+</span> Add Charge
                      </button>
                    </div>
                    {additionalCharges.map((charge, index) => (
                      <div key={index} className="flex items-center gap-3 mb-2">
                        <input
                          type="text"
                          value={charge.label}
                          onChange={(e) => updateAdditionalCharge(index, 'label', e.target.value)}
                          placeholder="e.g. Transport, Loading"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:border-green-500 focus:outline-none"
                        />
                        <input
                          type="number"
                          value={charge.amount || ''}
                          onChange={(e) => updateAdditionalCharge(index, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="₹0"
                          className="w-28 px-3 py-2 border border-gray-300 rounded text-sm text-right focus:border-green-500 focus:outline-none"
                          min="0"
                        />
                        <button
                          onClick={() => removeAdditionalCharge(index)}
                          className="text-red-500 hover:text-red-600 p-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Totals & Payment */}
                  <div className="mt-6 flex justify-end">
                    <div className="w-80 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-semibold">₹{getBillSubtotal().toLocaleString()}</span>
                      </div>
                      {additionalCharges.filter(c => c.amount > 0).map((charge, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-600">{charge.label || 'Additional'}</span>
                          <span className="font-semibold">₹{charge.amount.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-200">
                        <span>Current Bill</span>
                        <span>₹{getBillTotal().toLocaleString()}</span>
                      </div>

                      {/* Previous Balance */}
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                        <span className="text-gray-600">Previous Balance</span>
                        <input
                          type="number"
                          value={previousBalance || ''}
                          onChange={(e) => setPreviousBalance(parseFloat(e.target.value) || 0)}
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:border-green-500 focus:outline-none"
                          min="0"
                        />
                      </div>

                      <div className="flex justify-between text-sm font-bold bg-gray-100 px-2 py-1.5 rounded">
                        <span>Grand Total</span>
                        <span>₹{getGrandTotal().toLocaleString()}</span>
                      </div>

                      {/* Amount Received */}
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                        <span className="text-green-700 font-medium">Amount Received</span>
                        <input
                          type="number"
                          value={amountReceived || ''}
                          onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-28 px-2 py-1 border-2 border-green-400 rounded text-right text-sm focus:border-green-500 focus:outline-none bg-green-50"
                          min="0"
                        />
                      </div>

                      <div className={`flex justify-between text-lg font-bold pt-2 border-t-2 ${getBalanceDue() > 0 ? 'border-red-400' : 'border-green-400'}`}>
                        <span>Balance Due</span>
                        <span className={getBalanceDue() > 0 ? 'text-red-600' : 'text-green-600'}>
                          ₹{getBalanceDue().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                    <input
                      type="text"
                      value={billNotes}
                      onChange={(e) => setBillNotes(e.target.value)}
                      placeholder="Add any notes..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                /* Bill Preview */
                <div ref={billPreviewRef} className="bg-white">
                  {/* Header */}
                  <div className="text-center mb-4 border-b-2 border-blue-800 pb-4">
                    <div className="flex justify-between items-start text-xs text-gray-600 mb-1">
                      <span><strong>Ibrahim</strong> - Proprietor</span>
                      <span>Cell: 99087 04047</span>
                    </div>
                    <h1 className="text-2xl font-bold text-blue-800 tracking-wide">S.K.S. Co.</h1>
                    <p className="text-sm font-semibold text-gray-700 mt-1">FISH TRADING & PRAWN COMMISSION AGENT</p>
                    <p className="text-xs text-gray-500 mt-1">Sri Raghavendra Ice Factory, Near Indian Petrol Bunk, Muttukur Road, Nellore</p>
                  </div>

                  {/* Bill Info */}
                  <div className="flex justify-between mb-4 text-sm">
                    <div>
                      <p className="text-gray-600">Name:</p>
                      <p className="text-gray-800 font-semibold text-lg">{customers.find(c => c.id === billCustomerId)?.name}</p>
                    </div>
                    <div className="text-right">
                      <p><span className="text-gray-600">Bill No:</span> <span className="font-bold text-blue-800">{savedBill?.bill_number}</span></p>
                      <p><span className="text-gray-600">Date:</span> <span className="font-semibold">{new Date(date).toLocaleDateString('en-IN')}</span></p>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-gray-300 mb-4">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left text-sm font-semibold border border-gray-300">Item</th>
                        <th className="px-3 py-2 text-center text-sm font-semibold border border-gray-300">Qty (Kg)</th>
                        <th className="px-3 py-2 text-center text-sm font-semibold border border-gray-300">Rate/Kg</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold border border-gray-300">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billItems.map((item) => {
                        const amount = item.totalKg * item.ratePerKg;
                        return (
                          <tr key={item.varietyId}>
                            <td className="px-3 py-2 border border-gray-300 font-medium">{item.varietyName}</td>
                            <td className="px-3 py-2 border border-gray-300 text-center">
                              {item.crates} cr × {item.kgPerCrate}kg = {item.totalKg} kg
                            </td>
                            <td className="px-3 py-2 border border-gray-300 text-center">₹{item.ratePerKg}</td>
                            <td className="px-3 py-2 border border-gray-300 text-right font-semibold">₹{amount.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="flex justify-end">
                    <div className="w-80">
                      <div className="flex justify-between py-1 text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span>₹{getBillSubtotal().toLocaleString()}</span>
                      </div>
                      {additionalCharges.filter(c => c.amount > 0).map((charge, index) => (
                        <div key={index} className="flex justify-between py-1 text-sm">
                          <span className="text-gray-600">{charge.label || 'Additional'}</span>
                          <span>₹{charge.amount.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-1 text-sm font-semibold border-t border-gray-300 mt-1">
                        <span>Current Bill</span>
                        <span>₹{getBillTotal().toLocaleString()}</span>
                      </div>
                      {previousBalance > 0 && (
                        <div className="flex justify-between py-1 text-sm">
                          <span className="text-gray-600">Previous Balance</span>
                          <span>₹{previousBalance.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 text-sm font-bold bg-gray-100 px-2 rounded">
                        <span>Grand Total</span>
                        <span>₹{getGrandTotal().toLocaleString()}</span>
                      </div>
                      {amountReceived > 0 && (
                        <div className="flex justify-between py-1 text-sm text-green-700">
                          <span>Amount Received</span>
                          <span>-₹{amountReceived.toLocaleString()}</span>
                        </div>
                      )}
                      <div className={`flex justify-between py-2 text-lg font-bold border-t-2 mt-2 ${getBalanceDue() > 0 ? 'border-red-500' : 'border-green-500'}`}>
                        <span>Balance Due</span>
                        <span className={getBalanceDue() > 0 ? 'text-red-600' : 'text-green-600'}>
                          ₹{getBalanceDue().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {billNotes && (
                    <div className="mt-4 text-sm text-gray-600">
                      <span className="font-medium">Notes:</span> {billNotes}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3 justify-between">
              <div>
                {viewingExistingBill && showBillPreview && (
                  <button
                    onClick={handleEditBill}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Bill
                  </button>
                )}
              </div>
              <div className="flex gap-3">
              {!showBillPreview ? (
                <>
                  <button
                    onClick={closeBillModal}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={viewingExistingBill ? handleUpdateBill : handleSaveBill}
                    disabled={generatingBill}
                    className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingBill ? 'Saving...' : (viewingExistingBill ? 'Update Bill' : 'Generate Bill')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={closeBillModal}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={shareWhatsApp}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    onClick={printBill}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </button>
                </>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
