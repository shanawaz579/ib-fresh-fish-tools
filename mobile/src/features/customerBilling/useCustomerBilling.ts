import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  createBill,
  deleteBill,
  getBillById,
  getBillPreviewData,
  getBillsByDate,
  getCustomerOutstanding,
  getCustomers,
  getLastRateForVariety,
  getSalesByDate,
} from '../../api/stock';
import type { Bill, BillOtherCharge, Customer, Sale } from '../../types';
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

  const { date, goToPreviousDay, goToNextDay, goToToday } = useBusinessDate(params?.date);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(params?.customer_id || null);
  const [billItems, setBillItems] = useState<BillItemForm[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);

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
    const [customersData, salesData, billsData] = await Promise.all([
      getCustomers(),
      getSalesByDate(date),
      getBillsByDate(date),
    ]);
    setCustomers(customersData);
    setSales(salesData);
    setBills(billsData);
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

    // Validate that all rates are set
    const missingRates = billItems.some(item => item.rate_per_kg === 0);
    if (missingRates) {
      Alert.alert('Error', 'Please set rate per kg for all items');
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
      );

      if (bill) {
        const statusMsg = markAsPaid
          ? `Bill ${bill.bill_number} saved as PAID!`
          : `Bill ${bill.bill_number} saved!${quickPayments.length > 0 ? `\n${quickPayments.length} payment(s) recorded.` : ''}`;

        Alert.alert('Success', statusMsg);
        resetForm();
        await loadData();
        setSubmitting(false);
      } else {
        Alert.alert('Error', 'Failed to generate bill');
        setSubmitting(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to generate bill');
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
    if (!bill) return;

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
    setPreviewPreviousBalance(bill.previous_balance);
    setPreviewPayments(bill.payments || []);
    setPreviewBalanceDue(bill.balance_due);

    Alert.alert('Edit Mode', 'Bill loaded for editing. The original remains safe until you save.');
  };

  const handleDeleteBill = async (billId: number, billNumber: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete bill ${billNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteBill(billId);
            if (success) {
              Alert.alert('Success', 'Bill deleted successfully');
              await loadData();
            } else {
              Alert.alert('Error', 'Failed to delete bill');
            }
          },
        },
      ]
    );
  };

  const { itemsTotal, chargesTotal, subtotal, quickPaymentsTotal, total } = calculateTotals();
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleCustomerCreated = async (customer: Customer) => {
    setCustomers(current => {
      if (current.some(item => item.id === customer.id)) return current;
      return [...current, customer].sort((a, b) => a.name.localeCompare(b.name));
    });
    await handleCustomerSelect(customer.id);
  };

  return {
    date, goToPreviousDay, goToNextDay, goToToday,
    customers, bills, loading, loadingItems, selectedCustomerId, billItems, notes, setNotes, submitting,
    quickPayments, newPaymentAmount, setNewPaymentAmount, newPaymentMethod, setNewPaymentMethod,
    markAsPaid, setMarkAsPaid, otherCharges, setOtherCharges, customerOutstanding,
    previewPreviousBalance, previewPayments, previewBalanceDue,
    showPreview, setShowPreview, previewBill, previewCustomerName,
    handlePrintBill, handleShareBill, handleCustomerSelect, updateItemField, calculateItemAmount,
    handleAddQuickPayment, handleRemoveQuickPayment, handleGenerateBill, resetForm,
    handleViewBill, handleEditBill, handleDeleteBill, loadData,
    itemsTotal, chargesTotal, subtotal, quickPaymentsTotal, total, selectedCustomer,
    editingBillId, handleCustomerCreated,
  };
}
