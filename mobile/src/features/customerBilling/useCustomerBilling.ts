import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  createBill,
  getBillById,
  getBillPreviewData,
  getBillsByDate,
  getCustomerOutstanding,
  getCustomers,
  getFishVarieties,
  getLastRateForVariety,
  getSalesByDate,
} from '../../api/stock';
import type { Bill, BillOtherCharge, Customer, FishVariety, Sale } from '../../types';
import { DEFAULT_CRATE_WEIGHT_KG, getTotalWeightKg } from '../../domain/fish';
import {
  buildBillItemsFromSales,
  calculateBillItemAmount,
  calculateCustomerBillTotals,
  type BillItemForm,
} from '../../domain/customerBilling';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import { useCustomerBillDocuments } from './useCustomerBillDocuments';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type BillGenerationScreenRouteProp = RouteProp<RootStackParamList, 'BillGeneration'>;

export function useCustomerBilling() {
  const { configuration } = useBusinessConfig();
  const defaultCrateWeight = configuration.preferences.default_crate_weight_kg;
  const route = useRoute<BillGenerationScreenRouteProp>();
  const params = route.params;

  const {
    date,
    goToPreviousDay: navigateToPreviousDay,
    goToNextDay: navigateToNextDay,
    goToToday: navigateToToday,
  } = useBusinessDate(params?.date);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(params?.customer_id || null);
  const [billItems, setBillItems] = useState<BillItemForm[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');

  // Quick payments state (payments to record before generating bill)
  const [quickPayments, setQuickPayments] = useState<Array<{
    amount: number;
    payment_method: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
  }>>([]);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'>('cash');
  const [markAsPaid, setMarkAsPaid] = useState(false);

  // Other charges state
  const [otherCharges, setOtherCharges] = useState<BillOtherCharge[]>([]);

  // Customer outstanding
  const [customerOutstanding, setCustomerOutstanding] = useState({
    total_outstanding: 0,
    unpaid_bills_count: 0,
    oldest_bill_date: null as string | null,
  });

  // Preview data for current bill (previous balance and payments)
  const [previewPreviousBalance, setPreviewPreviousBalance] = useState(0);
  const [previewPayments, setPreviewPayments] = useState<any[]>([]);
  const [previewBalanceDue, setPreviewBalanceDue] = useState(0);

  // Bill preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);
  const previewCustomerName = customers.find(customer => customer.id === previewBill?.customer_id)?.name;
  const { handlePrintBill, handleShareBill } = useCustomerBillDocuments(previewBill, previewCustomerName);

  useEffect(() => {
    // Load preview data (previous balance and payments) when customer or date changes
    const loadPreviewData = async () => {
      if (editingBillId) return;
      if (selectedCustomerId) {
        const previewData = await getBillPreviewData(selectedCustomerId, date);
        setPreviewPreviousBalance(previewData.previousBalance);
        setPreviewPayments(previewData.payments);
        setPreviewBalanceDue(previewData.balanceDue);
      } else {
        setPreviewPreviousBalance(0);
        setPreviewPayments([]);
        setPreviewBalanceDue(0);
      }
    };
    loadPreviewData();
  }, [selectedCustomerId, date, editingBillId]);

  useEffect(() => {
    const loadAndRefreshCustomer = async () => {
      setLoadingItems(true);
      await loadData();
      // After loading new data, refresh customer sales if a customer is selected
      if (selectedCustomerId) {
        const freshSales = await getSalesByDate(date);
        const customerSales = freshSales.filter(s => s.customer_id === selectedCustomerId);

        if (customerSales.length === 0) {
          // Customer has no sales on this date, clear items
          setBillItems([]);
          setLoadingItems(false);
          return;
        }

        setBillItems(await buildBillItemsFromSales(customerSales, getLastRateForVariety, defaultCrateWeight));
      }
      setLoadingItems(false);
    };

    loadAndRefreshCustomer();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    const [customersData, salesData, billsData, varietyData] = await Promise.all([
      getCustomers(),
      getSalesByDate(date),
      getBillsByDate(date),
      getFishVarieties(),
    ]);
    setCustomers(customersData);
    setSales(salesData);
    setBills(billsData);
    setVarieties(varietyData);
    setLoading(false);
  };

  const loadCustomerSales = async (customerId: number) => {
    setLoadingItems(true);
    // Get sales for this customer on this date
    const customerSales = sales.filter(s => s.customer_id === customerId);

    if (customerSales.length === 0) {
      setLoadingItems(false);
      Alert.alert('No Sales', 'This customer has no sales for the selected date.');
      return;
    }

    setBillItems(await buildBillItemsFromSales(customerSales, getLastRateForVariety, defaultCrateWeight));
    setLoadingItems(false);
  };

  const handleCustomerSelect = async (customerId: number | null) => {
    if (editingBillId && customerId !== selectedCustomerId) {
      Alert.alert('Finish editing first', 'Save or cancel this correction before changing the customer.');
      return;
    }
    if (!customerId) {
      setSelectedCustomerId(null);
      setBillItems([]);
      setCustomerOutstanding({
        total_outstanding: 0,
        unpaid_bills_count: 0,
        oldest_bill_date: null,
      });
      return;
    }

    setSelectedCustomerId(customerId);
    loadCustomerSales(customerId);

    // Load customer outstanding balance
    const outstanding = await getCustomerOutstanding(customerId);
    setCustomerOutstanding(outstanding);
  };

  const updateItemField = (index: number, field: 'crate_weight' | 'rate_per_kg', value: string) => {
    const updated = [...billItems];
    const numValue = parseFloat(value) || 0;

    updated[index] = {
      ...updated[index],
      [field]: numValue,
    };

    // Recalculate total weight when crate_weight changes
    if (field === 'crate_weight') {
      updated[index].total_weight = getTotalWeightKg(updated[index].quantity_crates, updated[index].quantity_kg, numValue);
    }

    setBillItems(updated);
  };

  const updateItemQuantity = (index: number, field: 'quantity_crates' | 'quantity_kg', value: string) => {
    if (!editingBillId) return;
    const updated = [...billItems];
    const numeric = field === 'quantity_crates' ? Number.parseInt(value, 10) || 0 : Number.parseFloat(value) || 0;
    updated[index] = { ...updated[index], [field]: Math.max(0, numeric) };
    updated[index].total_weight = getTotalWeightKg(updated[index].quantity_crates, updated[index].quantity_kg, updated[index].crate_weight);
    setBillItems(updated);
  };

  const selectCorrectionItem = async (index: number | null, varietyId: number) => {
    if (!editingBillId) return;
    const variety = varieties.find(item => item.id === varietyId);
    if (!variety) return;
    if (billItems.some((item, itemIndex) => item.fish_variety_id === varietyId && itemIndex !== index)) {
      Alert.alert('Item already added', 'Each item and grade can appear only once in a sales bill.');
      return;
    }
    const lastRate = await getLastRateForVariety(varietyId);
    if (index === null) {
      setBillItems(current => [...current, {
        sale_ids: [], fish_variety_id: variety.id, fish_variety_name: variety.name,
        quantity_crates: 0, quantity_kg: 0,
        crate_weight: variety.default_kg_per_crate || defaultCrateWeight || DEFAULT_CRATE_WEIGHT_KG,
        total_weight: 0, rate_per_kg: lastRate?.rate_per_kg || 0,
      }]);
      return;
    }
    const crateWeight = variety.default_kg_per_crate || billItems[index].crate_weight;
    setBillItems(current => current.map((item, itemIndex) => itemIndex === index ? {
      ...item, fish_variety_id: variety.id, fish_variety_name: variety.name,
      crate_weight: crateWeight, rate_per_kg: lastRate?.rate_per_kg || item.rate_per_kg,
      total_weight: getTotalWeightKg(item.quantity_crates, item.quantity_kg, crateWeight),
    } : item));
  };

  const removeCorrectionItem = (index: number) => {
    if (editingBillId) setBillItems(current => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const calculateItemAmount = (item: BillItemForm): number => {
    return calculateBillItemAmount(item);
  };

  const calculateTotals = () => {
    return calculateCustomerBillTotals(billItems, otherCharges, previewBalanceDue, quickPayments);
  };

  const handleAddQuickPayment = () => {
    if (!newPaymentAmount) {
      Alert.alert('Error', 'Please enter payment amount');
      return;
    }

    const amount = parseFloat(newPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setQuickPayments([
      ...quickPayments,
      {
        amount,
        payment_method: newPaymentMethod,
      },
    ]);
    setNewPaymentAmount('');
  };

  const handleRemoveQuickPayment = (index: number) => {
    setQuickPayments(quickPayments.filter((_, i) => i !== index));
  };

  const handleGenerateBill = async () => {
    if (!selectedCustomerId) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    if (billItems.length === 0) {
      Alert.alert('Error', 'No items to bill');
      return;
    }

    if (editingBillId && correctionReason.trim().length < 5) {
      Alert.alert('Correction reason required', 'Enter at least 5 characters explaining what was wrong.');
      return;
    }

    // Validate that all rates are set
    const invalidRates = billItems.some(item => item.rate_per_kg <= 0 || item.rate_per_kg > 999);
    if (invalidRates) {
      Alert.alert('Invalid selling rate', 'Enter a selling rate from 1 to 999 for every item.');
      return;
    }
    if (billItems.some(item => item.quantity_crates < 0 || item.quantity_kg < 0 || (item.quantity_crates === 0 && item.quantity_kg === 0))) {
      Alert.alert('Invalid quantity', 'Every item needs crates, kilograms, or both.');
      return;
    }
    if (billItems.some(item => item.quantity_crates > 0 && item.crate_weight <= 0)) {
      Alert.alert('Invalid crate weight', 'Enter kilograms per crate for every item with crates.');
      return;
    }

    // Check if a bill already exists for this customer on this date
    const existingBill = bills.find(b => b.customer_id === selectedCustomerId && b.bill_date === date);
    if (existingBill && existingBill.id !== editingBillId) {
      Alert.alert(
        'Bill Already Exists',
        `A bill (${existingBill.bill_number}) already exists for this customer on this date. Please edit or delete the existing bill first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSubmitting(true);
    try {
      // Convert to BillItem format for the API
      const billItemsForAPI = billItems.map(item => ({
        sale_ids: item.sale_ids,
        fish_variety_id: item.fish_variety_id,
        fish_variety_name: item.fish_variety_name,
        quantity_crates: item.quantity_crates,
        quantity_kg: item.quantity_kg,
        crate_weight: item.crate_weight,
        rate_per_crate: 0, // Not used, all calculation is in kg
        rate_per_kg: item.rate_per_kg,
      }));

      const bill = await createBill(
        selectedCustomerId,
        date,
        billItemsForAPI,
        otherCharges, // Pass other charges
        0, // No discount/adjustment
        notes,
        quickPayments,
        markAsPaid,
        editingBillId || undefined,
        correctionReason,
      );

      const statusMsg = markAsPaid
        ? `Bill ${bill.bill_number} saved as PAID!`
        : `Bill ${bill.bill_number} saved!${quickPayments.length > 0 ? `\n${quickPayments.length} payment(s) recorded.` : ''}`;

      Alert.alert('Success', statusMsg);
      resetForm();
      await loadData();
    } catch (err) {
      const message = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : 'Please try again.';
      Alert.alert(editingBillId ? 'Unable to update bill' : 'Unable to create bill', message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId(null);
    setBillItems([]);
    setOtherCharges([]);
    setQuickPayments([]);
    setMarkAsPaid(false);
    setNotes('');
    setEditingBillId(null);
    setCorrectionReason('');
    setCustomerOutstanding({
      total_outstanding: 0,
      unpaid_bills_count: 0,
      oldest_bill_date: null,
    });
  };

  const handleViewBill = async (billId: number) => {
    const bill = await getBillById(billId);
    if (bill) {
      setPreviewBill(bill);
      setShowPreview(true);
    }
  };

  const handleEditBill = async (billId: number) => {
    const bill = await getBillById(billId);
    if (!bill) {
      Alert.alert('Unable to edit bill', 'The bill details could not be loaded. Check the connection and try again.');
      return;
    }
    if (!bill.items?.length) {
      Alert.alert('Unable to edit bill', 'This bill has no linked sale items. It was not changed.');
      return;
    }

    // Load bill data into form for editing
    setSelectedCustomerId(bill.customer_id);

    // Convert bill items to form format
    const formItems: BillItemForm[] = (bill.items || []).map(item => {
      const crateWeight = item.crate_weight ?? defaultCrateWeight ?? DEFAULT_CRATE_WEIGHT_KG;
      const totalWeight = getTotalWeightKg(item.quantity_crates, item.quantity_kg, crateWeight);
      return {
        sale_ids: item.sale_ids ?? [],
        fish_variety_id: item.fish_variety_id,
        fish_variety_name: item.fish_variety_name,
        quantity_crates: item.quantity_crates,
        quantity_kg: item.quantity_kg,
        crate_weight: crateWeight,
        total_weight: totalWeight,
        rate_per_kg: item.rate_per_kg,
      };
    });

    setBillItems(formItems);
    setOtherCharges(bill.other_charges || []);
    setNotes(bill.notes || '');
    setEditingBillId(billId);
    setCorrectionReason('');
    setPreviewPreviousBalance(bill.previous_balance);
    setPreviewPayments(bill.payments || []);
    setPreviewBalanceDue(bill.balance_due);

    Alert.alert('Correction mode', 'Update the bill and enter a reason. The original values will remain in audit history until you save successfully.');
  };

  const { itemsTotal, chargesTotal, subtotal, currentBillTotal, quickPaymentsTotal, total } = calculateTotals();
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleCustomerCreated = async (customer: Customer) => {
    setCustomers(current => {
      if (current.some(item => item.id === customer.id)) return current;
      return [...current, customer].sort((a, b) => a.name.localeCompare(b.name));
    });
    await handleCustomerSelect(customer.id);
  };

  const guardDateChange = (changeDate: () => void) => {
    if (editingBillId) {
      Alert.alert('Finish editing first', 'Save or cancel this correction before changing the bill date.');
      return;
    }
    changeDate();
  };

  return {
    date,
    goToPreviousDay: () => guardDateChange(navigateToPreviousDay),
    goToNextDay: () => guardDateChange(navigateToNextDay),
    goToToday: () => guardDateChange(navigateToToday),
    customers, varieties, bills, loading, loadingItems, selectedCustomerId, billItems, notes, setNotes, submitting,
    quickPayments, newPaymentAmount, setNewPaymentAmount, newPaymentMethod, setNewPaymentMethod,
    markAsPaid, setMarkAsPaid, otherCharges, setOtherCharges, customerOutstanding,
    previewPreviousBalance, previewPayments, previewBalanceDue,
    showPreview, setShowPreview, previewBill, previewCustomerName,
    handlePrintBill, handleShareBill, handleCustomerSelect, updateItemField, updateItemQuantity,
    selectCorrectionItem, removeCorrectionItem, calculateItemAmount,
    handleAddQuickPayment, handleRemoveQuickPayment, handleGenerateBill, resetForm,
    handleViewBill, handleEditBill, loadData,
    itemsTotal, chargesTotal, subtotal, currentBillTotal, quickPaymentsTotal, total, selectedCustomer,
    editingBillId, correctionReason, setCorrectionReason, handleCustomerCreated,
  };
}
