import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  deleteSale,
  getCustomers,
  getFishVarieties,
  getFrequentSaleVarietyIds,
  getSalesByDate,
  getStockSnapshot,
  saveSalesBatch,
  updateSalesGroup,
} from '../../api/stock';
import type { Customer, FishVariety, Sale } from '../../types';
import type { StockSnapshot } from '../../domain/stockLedger';
import { getTotalWeightKg, sortFishVarieties } from '../../domain/fish';
import { useBusinessDate } from '../../hooks/useBusinessDate';

export function useSalesRecords() {
  const { date, goToPreviousDay, goToNextDay, goToToday } = useBusinessDate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockSnapshot, setStockSnapshot] = useState<StockSnapshot[]>([]);
  const [frequentVarietyIds, setFrequentVarietyIds] = useState<number[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [fishVarietyId, setFishVarietyId] = useState<number | null>(null);
  const [quantityCrates, setQuantityCrates] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingDraftVarietyId, setEditingDraftVarietyId] = useState<number | null>(null);
  const [tempItems, setTempItems] = useState<Array<{
    varietyId: number;
    varietyName: string;
    crates: number;
    kg: number;
  }>>([]);

  // Edit mode state
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  // Collapse state - track which customer cards are collapsed
  const [collapsedCustomers, setCollapsedCustomers] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [varietiesData, customersData, snapshotData, salesData, frequentIds] = await Promise.all([
      getFishVarieties(),
      getCustomers(),
      getStockSnapshot(date),
      getSalesByDate(date),
      getFrequentSaleVarietyIds(),
    ]);

    // Sort varieties same as web
    const sortedVarieties = sortFishVarieties(varietiesData);

    setVarieties(sortedVarieties);
    setCustomers(customersData);
    setStockSnapshot(snapshotData);
    setSales(salesData);
    setFrequentVarietyIds(frequentIds);
    if (!isRefreshing) {
      setCollapsedCustomers(new Set(salesData.map((sale) => sale.customer_id)));
    }

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const toggleCustomerCollapse = (customerId: number) => {
    setCollapsedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const toggleAllCustomers = () => {
    const allCustomerIds = Object.values(sortedGroupedSales).map(sales => sales[0]?.customer_id).filter(Boolean);

    // If all are collapsed, expand all. Otherwise, collapse all.
    const allCollapsed = allCustomerIds.every(id => collapsedCustomers.has(id));

    if (allCollapsed) {
      setCollapsedCustomers(new Set());
    } else {
      setCollapsedCustomers(new Set(allCustomerIds));
    }
  };

  const handleAddItem = () => {
    if (!fishVarietyId) {
      Alert.alert('Error', 'Please select fish type');
      return;
    }

    const crates = parseInt(quantityCrates) || 0;
    const kg = parseFloat(quantityKg) || 0;

    if (crates < 0 || kg < 0 || (crates === 0 && kg === 0)) {
      Alert.alert('Check quantity', 'Enter crates, kg, or both. Values cannot be negative.');
      return;
    }

    const variety = varieties.find(v => v.id === fishVarietyId);
    if (!variety) return;

    const available = getStockForVariety(fishVarietyId).available;
    const existingDraft = tempItems.find((item) => item.varietyId === fishVarietyId);
    const draftBeingEdited = editingDraftVarietyId === null
      ? undefined
      : tempItems.find((item) => item.varietyId === editingDraftVarietyId);
    const isUpdatingDraft = editingDraftVarietyId !== null;
    const requestedCrates = isUpdatingDraft ? crates : (existingDraft?.crates ?? 0) + crates;
    const requestedKg = isUpdatingDraft ? kg : (existingDraft?.kg ?? 0) + kg;
    const editingSameVariety = draftBeingEdited?.varietyId === fishVarietyId;
    const capacityCrates = available.crates + (editingSameVariety ? draftBeingEdited.crates : existingDraft?.crates ?? 0);
    const capacityKg = available.kg + (editingSameVariety ? draftBeingEdited.kg : existingDraft?.kg ?? 0);
    if (requestedCrates > capacityCrates || requestedKg > capacityKg) {
      Alert.alert(
        'Insufficient stock',
        `Available: ${capacityCrates} cr · ${capacityKg} kg`,
      );
      return;
    }

    if (isUpdatingDraft) {
      const conflictingDraft = tempItems.some((item) => (
        item.varietyId === fishVarietyId && item.varietyId !== editingDraftVarietyId
      ));
      if (conflictingDraft) {
        Alert.alert('Item already added', 'Remove the duplicate line or edit that line instead.');
        return;
      }

      setTempItems(tempItems.map((item) => (
        item.varietyId === editingDraftVarietyId
          ? { varietyId: fishVarietyId, varietyName: variety.name, crates, kg }
          : item
      )));
      setEditingDraftVarietyId(null);
      // Check if variety already exists in temp items
    } else {
      const existingIndex = tempItems.findIndex(item => item.varietyId === fishVarietyId);
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...tempItems];
        updated[existingIndex].crates += crates;
        updated[existingIndex].kg += kg;
        setTempItems(updated);
      } else {
        // Add new item
        setTempItems([...tempItems, {
          varietyId: fishVarietyId,
          varietyName: variety.name,
          crates,
          kg,
        }]);
      }
    }

    // Clear only the variety and quantities, keep customer selected
    setFishVarietyId(null);
    setQuantityCrates('');
    setQuantityKg('');
  };

  const handleRemoveTempItem = (index: number) => {
    if (tempItems[index]?.varietyId === editingDraftVarietyId) {
      setEditingDraftVarietyId(null);
      setFishVarietyId(null);
      setQuantityCrates('');
      setQuantityKg('');
    }
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  const handleEditTempItem = (index: number) => {
    const item = tempItems[index];

    // Load item into form
    setFishVarietyId(item.varietyId);
    setQuantityCrates(item.crates.toString());
    setQuantityKg(item.kg.toString());

    setEditingDraftVarietyId(item.varietyId);
  };

  const handleSaveAll = async () => {
    if (!customerId || tempItems.length === 0) {
      Alert.alert('Error', 'Please select a customer and add at least one item');
      return;
    }
    if (editingDraftVarietyId !== null) {
      Alert.alert('Finish item edit', 'Tap Update item before saving the sale.');
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        customerId,
        saleDate: date,
        items: tempItems.map((item) => ({
          fishVarietyId: item.varietyId,
          quantityCrates: item.crates,
          quantityKg: item.kg,
        })),
      };
      if (editingCustomerId) await updateSalesGroup(input);
      else await saveSalesBatch(input);

      // Clear form
      setTempItems([]);
      setCustomerId(null);
      setEditingCustomerId(null);
      setFishVarietyId(null);
      setQuantityCrates('');
      setQuantityKg('');
      setEditingDraftVarietyId(null);

      loadData();
      Alert.alert('Success', editingCustomerId ? 'Sale updated successfully' : `${tempItems.length} item(s) added successfully`);
    } catch (err) {
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Failed to add sales';
      Alert.alert('Unable to save sale', message);
    }
    setSubmitting(false);
  };

  const handleCustomerChange = (nextCustomerId: number | null) => {
    if (editingCustomerId) return;
    if (nextCustomerId === customerId) return;
    if (tempItems.length > 0) {
      Alert.alert('Change customer?', 'Changing customer will clear the draft sale.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', style: 'destructive', onPress: () => { setTempItems([]); setCustomerId(nextCustomerId); } },
      ]);
      return;
    }
    setCustomerId(nextCustomerId);
  };

  const handleCustomerCreated = (customer: Customer) => {
    setCustomers((current) => [...current, customer].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerId(customer.id);
  };

  const refreshVarieties = async (preferredItemCode?: string) => {
    const itemRows = sortFishVarieties(await getFishVarieties());
    setVarieties(itemRows);
    if (preferredItemCode) {
      const firstVariant = itemRows.find((variant) => variant.item_code === preferredItemCode);
      const available = firstVariant
        ? stockSnapshot.find((snapshot) => snapshot.itemVariantId === firstVariant.id)
        : undefined;
      if (firstVariant && available && (available.closingCrates > 0 || available.closingKg > 0)) {
        setFishVarietyId(firstVariant.id);
      } else {
        Alert.alert('Catalog item created', 'Record a purchase or stock adjustment before selling this item.');
      }
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this sale?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteSale(id);
            if (success) {
              loadData();
            } else {
              Alert.alert('Error', 'Failed to delete sale');
            }
          },
        },
      ]
    );
  };

  // Edit mode functions
  const handleEditCustomer = (customerId: number, customerSales: Sale[]) => {
    setEditingCustomerId(customerId);
    setCustomerId(customerId);
    const grouped = new Map<number, { varietyId: number; varietyName: string; crates: number; kg: number }>();
    customerSales.forEach(sale => {
      const current = grouped.get(sale.fish_variety_id) ?? {
        varietyId: sale.fish_variety_id,
        varietyName: sale.fish_variety_name || 'Unknown',
        crates: 0,
        kg: 0,
      };
      current.crates += sale.quantity_crates;
      current.kg += sale.quantity_kg;
      grouped.set(sale.fish_variety_id, current);
    });
    setTempItems([...grouped.values()]);
    setFishVarietyId(null);
    setQuantityCrates('');
    setQuantityKg('');
    setEditingDraftVarietyId(null);

    // Ensure the card is expanded when editing
    setCollapsedCustomers(prev => {
      const newSet = new Set(prev);
      newSet.delete(customerId);
      return newSet;
    });
  };

  const handleCancelEdit = () => {
    setEditingCustomerId(null);
    setCustomerId(null);
    setTempItems([]);
    setFishVarietyId(null);
    setQuantityCrates('');
    setQuantityKg('');
    setEditingDraftVarietyId(null);
  };

  // Calculate stock for a variety
  const getStockForVariety = (varietyId: number) => {
    const snapshot = stockSnapshot.find((item) => item.itemVariantId === varietyId);
    const purchased = {
      crates: (snapshot?.openingCrates ?? 0) + (snapshot?.inwardCrates ?? 0),
      kg: (snapshot?.openingKg ?? 0) + (snapshot?.inwardKg ?? 0),
    };
    const sold = {
      crates: snapshot?.outwardCrates ?? 0,
      kg: snapshot?.outwardKg ?? 0,
    };

    const editableSales = editingCustomerId
      ? sales.filter(sale => sale.customer_id === editingCustomerId && sale.fish_variety_id === varietyId)
      : [];
    const editableCrates = editableSales.reduce((sum, sale) => sum + sale.quantity_crates, 0);
    const editableKg = editableSales.reduce((sum, sale) => sum + sale.quantity_kg, 0);
    const drafted = tempItems.find(item => item.varietyId === varietyId);

    return {
      purchased,
      sold,
      available: {
        crates: Math.max((snapshot?.closingCrates ?? 0) + editableCrates - (drafted?.crates ?? 0), 0),
        kg: Math.max((snapshot?.closingKg ?? 0) + editableKg - (drafted?.kg ?? 0), 0),
      },
    };
  };

  // Group sales by customer
  const groupedSales = sales.reduce((acc, sale) => {
    const customerName = sale.customer_name || 'Unknown';
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(sale);
    return acc;
  }, {} as Record<string, Sale[]>);

  // Sort customers: Wholesale Market first, then others, both sorted by total amount descending
  const sortedGroupedSales = Object.entries(groupedSales).sort(([nameA, salesA], [nameB, salesB]) => {
    const customerA = customers.find(c => c.name === nameA);
    const customerB = customers.find(c => c.name === nameB);

    const isWholesaleA = customerA?.business_type === 'Wholesale Market';
    const isWholesaleB = customerB?.business_type === 'Wholesale Market';

    // Wholesale Market customers come first
    if (isWholesaleA && !isWholesaleB) return -1;
    if (!isWholesaleA && isWholesaleB) return 1;

    // Within each group, sort by total amount (descending)
    const weightA = salesA.reduce((sum, sale) => sum + getTotalWeightKg(sale.quantity_crates, sale.quantity_kg), 0);
    const weightB = salesB.reduce((sum, sale) => sum + getTotalWeightKg(sale.quantity_crates, sale.quantity_kg), 0);

    return weightB - weightA;
  }).reduce((acc, [name, sales]) => {
    acc[name] = sales;
    return acc;
  }, {} as Record<string, Sale[]>);

  return {
    date, goToPreviousDay, goToNextDay, goToToday,
    varieties, customers, frequentVarietyIds, loading, refreshing, submitting,
    customerId, setCustomerId, fishVarietyId, setFishVarietyId,
    quantityCrates, setQuantityCrates, quantityKg, setQuantityKg,
    tempItems, editingCustomerId, editingDraftVarietyId, collapsedCustomers, sortedGroupedSales,
    onRefresh, toggleCustomerCollapse, toggleAllCustomers, handleAddItem, handleRemoveTempItem,
    handleEditTempItem, handleSaveAll, handleDelete, handleEditCustomer,
    handleCancelEdit, getStockForVariety, handleCustomerChange, handleCustomerCreated, refreshVarieties,
  };
}
