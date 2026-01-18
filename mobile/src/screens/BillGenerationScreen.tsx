import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Share,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  getCustomers,
  getSalesByDate,
  getFishVarieties,
  createBill,
  getLastRateForVariety,
  getBillsByDate,
  deleteBill,
  getBillById,
  getCustomerOutstanding,
  getUnpaidBills,
  createPayment,
  autoAllocatePayment,
  getBillPreviewData,
} from '../api/stock';
import type { Customer, Sale, FishVariety, Bill, BillItem, BillOtherCharge } from '../types';
import PaymentDialog from '../components/PaymentDialog';
import CustomerOutstandingCard from '../components/CustomerOutstandingCard';
import OtherChargesSection from '../components/OtherChargesSection';

type BillItemForm = {
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  crate_weight: number; // kg per crate
  total_weight: number; // calculated total weight in kg
  rate_per_kg: number;
};

type BillGenerationScreenRouteProp = RouteProp<RootStackParamList, 'BillGeneration'>;

export default function BillGenerationScreen() {
  const route = useRoute<BillGenerationScreenRouteProp>();
  const params = route.params;

  const [date, setDate] = useState(params?.date || new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(params?.customer_id || null);
  const [billItems, setBillItems] = useState<BillItemForm[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [createdBillId, setCreatedBillId] = useState<number | null>(null);

  // Bill preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);

  useEffect(() => {
    // Load preview data (previous balance and payments) when customer or date changes
    const loadPreviewData = async () => {
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
  }, [selectedCustomerId, date]);

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

        // Rebuild bill items from fresh sales data
        const itemsMap: { [varietyId: number]: BillItemForm } = {};

        for (const sale of customerSales) {
          if (!itemsMap[sale.fish_variety_id]) {
            const lastRate = await getLastRateForVariety(sale.fish_variety_id);
            const crateWeight = 35;

            itemsMap[sale.fish_variety_id] = {
              fish_variety_id: sale.fish_variety_id,
              fish_variety_name: sale.fish_variety_name || 'Unknown',
              quantity_crates: 0,
              quantity_kg: 0,
              crate_weight: crateWeight,
              total_weight: 0,
              rate_per_kg: lastRate?.rate_per_kg || 0,
            };
          }

          itemsMap[sale.fish_variety_id].quantity_crates += sale.quantity_crates;
          itemsMap[sale.fish_variety_id].quantity_kg += sale.quantity_kg;
        }

        const items = Object.values(itemsMap).map(item => ({
          ...item,
          total_weight: (item.quantity_crates * item.crate_weight) + item.quantity_kg,
        }));

        setBillItems(items);
      }
      setLoadingItems(false);
    };

    loadAndRefreshCustomer();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    const [customersData, salesData, varietiesData, billsData] = await Promise.all([
      getCustomers(),
      getSalesByDate(date),
      getFishVarieties(),
      getBillsByDate(date),
    ]);
    setCustomers(customersData);
    setSales(salesData);
    setVarieties(varietiesData);
    setBills(billsData);
    setLoading(false);
  };

  const goToPreviousDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
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

    // Group by variety and load last rates
    const itemsMap: { [varietyId: number]: BillItemForm } = {};

    for (const sale of customerSales) {
      if (!itemsMap[sale.fish_variety_id]) {
        // Get last rate for this variety
        const lastRate = await getLastRateForVariety(sale.fish_variety_id);

        const crateWeight = 35; // Default crate weight in kg
        const crates = 0;
        const looseKg = 0;
        const totalWeight = (crates * crateWeight) + looseKg;

        itemsMap[sale.fish_variety_id] = {
          fish_variety_id: sale.fish_variety_id,
          fish_variety_name: sale.fish_variety_name || 'Unknown',
          quantity_crates: 0,
          quantity_kg: 0,
          crate_weight: crateWeight,
          total_weight: totalWeight,
          rate_per_kg: lastRate?.rate_per_kg || 0,
        };
      }

      // Add quantities
      itemsMap[sale.fish_variety_id].quantity_crates += sale.quantity_crates;
      itemsMap[sale.fish_variety_id].quantity_kg += sale.quantity_kg;
    }

    // Recalculate total weight for each item
    const items = Object.values(itemsMap).map(item => ({
      ...item,
      total_weight: (item.quantity_crates * item.crate_weight) + item.quantity_kg,
    }));

    setBillItems(items);
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
      updated[index].total_weight = (updated[index].quantity_crates * numValue) + updated[index].quantity_kg;
    }

    setBillItems(updated);
  };

  const calculateItemAmount = (item: BillItemForm): number => {
    return Math.round(item.total_weight * item.rate_per_kg);
  };

  const calculateTotals = () => {
    const itemsTotal = billItems.reduce((sum, item) => sum + calculateItemAmount(item), 0);
    const chargesTotal = otherCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const subtotal = itemsTotal + chargesTotal;

    // Calculate total quick payments to show in preview
    const quickPaymentsTotal = quickPayments.reduce((sum, payment) => sum + payment.amount, 0);

    // Total = previous balance - old payments + new subtotal - quick payments
    const total = previewBalanceDue + subtotal - quickPaymentsTotal;
    return { itemsTotal, chargesTotal, subtotal, quickPaymentsTotal, total };
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

  const handleGenerateBill = async (recordPayment: boolean = false) => {
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
    if (existingBill) {
      Alert.alert(
        'Bill Already Exists',
        `A bill (${existingBill.bill_number}) already exists for this customer on this date. Please edit or delete the existing bill first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setSubmitting(true);
    try {
      // First, save all quick payments (using the bill date)
      if (quickPayments.length > 0) {
        for (const payment of quickPayments) {
          await createPayment(
            selectedCustomerId,
            date, // Use the bill date
            payment.amount,
            payment.payment_method,
            '', // No reference
            '' // No notes
          );
        }
      }

      // If marking as paid, record a payment for the full bill amount
      if (markAsPaid) {
        const { itemsTotal, chargesTotal, subtotal } = calculateTotals();
        const totalAmount = previewBalanceDue + subtotal;

        await createPayment(
          selectedCustomerId,
          date,
          totalAmount,
          'cash', // Default to cash, user can edit later if needed
          '',
          'Full payment for this bill'
        );
      }

      // Convert to BillItem format for the API
      const billItemsForAPI = billItems.map(item => ({
        fish_variety_id: item.fish_variety_id,
        fish_variety_name: item.fish_variety_name,
        quantity_crates: item.quantity_crates,
        quantity_kg: item.quantity_kg,
        rate_per_crate: 0, // Not used, all calculation is in kg
        rate_per_kg: item.rate_per_kg,
      }));

      const bill = await createBill(
        selectedCustomerId,
        date,
        billItemsForAPI,
        otherCharges, // Pass other charges
        0, // No discount/adjustment
        notes
      );

      if (bill) {
        if (recordPayment) {
          // Open payment modal
          setCreatedBillId(bill.id);
          setPaymentAmount(bill.total.toString());
          setShowPaymentModal(true);
          setSubmitting(false);
        } else {
          const statusMsg = markAsPaid
            ? `Bill ${bill.bill_number} saved as PAID!`
            : `Bill ${bill.bill_number} saved!${quickPayments.length > 0 ? `\n${quickPayments.length} payment(s) recorded.` : ''}`;

          Alert.alert('Success', statusMsg);

          // Reset form
          resetForm();

          // Reload bills
          await loadData();
          setSubmitting(false);
        }
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
      const totalWeight = (item.quantity_crates * 35) + item.quantity_kg;
      return {
        fish_variety_id: item.fish_variety_id,
        fish_variety_name: item.fish_variety_name,
        quantity_crates: item.quantity_crates,
        quantity_kg: item.quantity_kg,
        crate_weight: 35,
        total_weight: totalWeight,
        rate_per_kg: item.rate_per_kg,
      };
    });

    setBillItems(formItems);
    setNotes(bill.notes || '');

    // Delete the old bill
    await deleteBill(billId);
    await loadData();

    Alert.alert('Edit Mode', 'Bill loaded for editing. Make your changes and save.');
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

  const handleShareBill = async () => {
    if (!previewBill) return;

    const customer = customers.find(c => c.id === previewBill.customer_id);

    // Calculate total weight for each item (crates * 35 + loose kg)
    const billText = `
Ibrahim Shaik (IB-NLR)                    📞 99087 04047
                *S.K.S. Co.*
        Wholesale Fish & Prawn Trading
   Raghavendra Ice Factory, Muttukur Road, Nellore,AP.

━━━━━━━━━━━━━━━━━━━━━━
Bill No: ${previewBill.bill_number}
Date: ${new Date(previewBill.bill_date).toLocaleDateString('en-IN')}
Customer: ${customer?.name || 'Unknown'}

*Items:*
${(previewBill.items || []).map(item => {
  const crateWeight = 35; // kg per crate
  const totalWeight = (item.quantity_crates * crateWeight) + item.quantity_kg;
  const qtyParts = [];
  if (item.quantity_crates > 0) qtyParts.push(`${item.quantity_crates} crates`);
  if (item.quantity_kg > 0) qtyParts.push(`${item.quantity_kg} kg`);
  const qtyText = qtyParts.length > 0 ? qtyParts.join(' + ') : '0 kg';
  return `${item.fish_variety_name}
  Qty: ${qtyText}
  Total Weight: ${totalWeight.toFixed(2)} kg
  Rate: ₹${item.rate_per_kg}/kg
  Amount: ₹${item.amount.toFixed(2)}`;
}).join('\n\n')}

${(() => {
  const itemsTotal = (previewBill.items || []).reduce((sum, item) => sum + item.amount, 0);
  const otherChargesTotal = (previewBill.other_charges || []).reduce((sum, charge) => sum + charge.amount, 0);
  let breakdown = `*Items Total:* ₹${itemsTotal.toFixed(2)}`;

  if (previewBill.other_charges && previewBill.other_charges.length > 0) {
    breakdown += '\n\n*Other Charges:*';
    previewBill.other_charges.forEach(charge => {
      const chargeName = charge.charge_type.charAt(0).toUpperCase() + charge.charge_type.slice(1);
      const desc = charge.description ? ` (${charge.description})` : '';
      breakdown += `\n  + ${chargeName}${desc}: ₹${charge.amount.toFixed(2)}`;
    });
    breakdown += `\n\n*Subtotal:* ₹${(itemsTotal + otherChargesTotal).toFixed(2)}`;
  }

  if (previewBill.discount > 0) {
    breakdown += `\n*Discount:* ₹${previewBill.discount.toFixed(2)}`;
  }

  breakdown += `\n*Total:* ₹${previewBill.total.toFixed(2)}`;

  return breakdown;
})()}

${previewBill.notes ? `Notes: ${previewBill.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━
Thank you for your business!
    `.trim();

    try {
      await Share.share({
        message: billText,
        title: `Bill ${previewBill.bill_number}`,
      });
    } catch (err) {
      console.error('Error sharing bill:', err);
    }
  };

  const handlePrintBill = async () => {
    if (!previewBill) return;

    const customer = customers.find(c => c.id === previewBill.customer_id);

    // Generate HTML for PDF (matching purchase bill format)
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @page {
          size: A4;
          margin: 10mm;
        }
        body {
          font-family: 'Arial', sans-serif;
          padding: 0;
          margin: 0;
          font-size: 12px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .content-wrapper {
          flex: 1;
        }
        .header {
          background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
          padding: 10px 16px;
          border-bottom: 3px solid #0ea5e9;
          margin-bottom: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 12px;
        }
        .company-name {
          font-size: 24px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 2px;
          text-align: center;
          margin-bottom: 4px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }
        .proprietor {
          color: #1e293b;
          font-weight: 700;
          font-size: 12px;
        }
        .contact {
          color: #0284c7;
          font-weight: 800;
          font-size: 13px;
        }
        .tagline {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          text-align: center;
          margin-bottom: 4px;
        }
        .address {
          font-size: 11px;
          color: #64748b;
          text-align: center;
          font-weight: 500;
        }
        .customer-section {
          margin-bottom: 10px;
          padding: 10px;
          background: #f9fafb;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .customer-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .customer-left {
          flex: 1;
        }
        .customer-right {
          text-align: right;
          background: #fff;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .customer-name {
          font-size: 16px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 2px;
        }
        .total-boxes {
          font-size: 11px;
          color: #6b7280;
          font-weight: 500;
        }
        .bill-number {
          font-size: 14px;
          font-weight: 800;
          color: #0ea5e9;
          margin-bottom: 2px;
        }
        .bill-date {
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
        }
        thead {
          background: linear-gradient(to bottom, #1e293b, #334155);
        }
        th {
          padding: 6px 4px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        td {
          padding: 6px 4px;
          font-size: 12px;
          color: #111827;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
          vertical-align: middle;
        }
        tbody tr:nth-child(even) td {
          background: #f9fafb;
        }
        tbody tr:hover td {
          background: #f0f9ff;
        }
        .text-center {
          text-align: center;
        }
        .text-right {
          text-align: right;
        }
        .totals {
          margin-top: 10px;
          padding: 10px;
          background: linear-gradient(to bottom, #f8fafc, #ffffff);
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;
          padding: 1px 0;
        }
        .total-label {
          color: #475569;
          font-weight: 600;
        }
        .total-value {
          font-weight: 700;
          color: #111827;
        }
        .charge-row {
          padding-left: 20px;
          border-left: 3px solid #e0f2fe;
        }
        .charge-label {
          font-weight: 500;
          font-size: 12px;
          color: #64748b;
        }
        .charge-value {
          font-size: 12px;
          color: #059669;
          font-weight: 700;
        }
        .separator {
          height: 1px;
          background: linear-gradient(to right, #e5e7eb, #cbd5e1, #e5e7eb);
          margin: 6px 0;
        }
        .grand-total {
          margin-top: 8px;
          padding: 8px;
          border-top: 3px solid #3b82f6;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 6px;
        }
        .grand-total .total-label {
          font-size: 15px;
          font-weight: 900;
          color: #1e3a8a;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .grand-total .total-value {
          font-size: 18px;
          font-weight: 900;
          color: #1e40af;
        }
        .payment-paid {
          color: #059669;
          font-weight: 700;
        }
        .payment-due {
          color: #DC2626;
          font-weight: 700;
        }
        .notes {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
        }
        .notes-title {
          font-size: 9px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 3px;
        }
        .notes-text {
          font-size: 10px;
          color: #374151;
          font-style: italic;
        }
        .footer {
          margin-top: auto;
          padding-top: 10px;
          padding-bottom: 8px;
          border-top: 3px double #cbd5e1;
          text-align: center;
          background: linear-gradient(to top, #f8fafc, transparent);
        }
        .footer-text {
          font-size: 13px;
          font-weight: 700;
          color: #059669;
          letter-spacing: 0.4px;
        }
      </style>
    </head>
    <body>
      <div class="content-wrapper">
        <div class="header">
          <div class="header-top">
            <span class="proprietor">Ibrahim Shaik (IB-NLR)</span>
            <span class="contact">📞 99087 04047</span>
          </div>
          <div class="company-name">SKS SEA FOODS</div>
          <div class="tagline">Wholesale Fish & Prawn Trading</div>
          <div class="address">Raghavendra Ice Factory, Muttukur Road, Nellore, AP.</div>
        </div>

        <div class="customer-section">
          <div class="customer-row">
            <div class="customer-left">
              <div class="customer-name">${customer?.name || 'Unknown'}</div>
              <div class="total-boxes">Total: ${(previewBill.items || []).reduce((sum, item) => sum + item.quantity_crates, 0)} boxes</div>
            </div>
            <div class="customer-right">
              <div class="bill-number">${previewBill.bill_number}</div>
              <div class="bill-date">${new Date(previewBill.bill_date).toLocaleDateString('en-IN')}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-center">Qty</th>
              <th class="text-center">Weight (kg)</th>
              <th class="text-center">Rate (₹/kg)</th>
              <th class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${(previewBill.items || []).map(item => {
              const crateWeight = 35;
              const totalWeight = (item.quantity_crates * crateWeight) + item.quantity_kg;
              let qtyText = '';
              if (item.quantity_crates > 0 && item.quantity_kg > 0) {
                qtyText = `${item.quantity_crates}+${item.quantity_kg}kg`;
              } else if (item.quantity_crates > 0) {
                qtyText = `${item.quantity_crates} cr`;
              } else if (item.quantity_kg > 0) {
                qtyText = `${item.quantity_kg} kg`;
              } else {
                qtyText = '0';
              }
              return `
              <tr>
                <td>${item.fish_variety_name}</td>
                <td class="text-center">${qtyText}</td>
                <td class="text-center">${totalWeight}</td>
                <td class="text-center">${item.rate_per_kg}</td>
                <td class="text-right">${item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="totals">
          ${(() => {
            const itemsTotal = (previewBill.items || []).reduce((sum, item) => sum + item.amount, 0);
            const otherChargesTotal = (previewBill.other_charges || []).reduce((sum, charge) => sum + charge.amount, 0);
            const subtotal = itemsTotal + otherChargesTotal;
            let html = '';

            // Previous Balance Section
            if (previewBill.previous_balance && previewBill.previous_balance > 0) {
              html += `
                <div class="total-row">
                  <span class="total-label">Previous Balance:</span>
                  <span class="total-value">₹${previewBill.previous_balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              `;
            }

            // Payments Received - Show independently of previous balance
            if (previewBill.payments && previewBill.payments.length > 0) {
              html += `<div style="margin-top: 8px; margin-bottom: 4px; font-weight: 600; font-size: 11px; color: #059669;">Less: Payments Received</div>`;
              previewBill.payments.forEach(payment => {
                const paymentDate = new Date(payment.payment_date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
                const paymentMethod = payment.payment_method.toUpperCase();
                html += `
                  <div class="total-row charge-row">
                    <span class="charge-label">${paymentDate} - ${paymentMethod}:</span>
                    <span class="total-value payment-paid">₹${payment.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                `;
              });

              // Show Credit Balance / Balance Outstanding after payments
              const balanceLabel = previewBill.balance_due < 0 ? 'Credit Balance:' : 'Balance Outstanding:';
              html += `
                <div class="total-row">
                  <span class="total-label">${balanceLabel}</span>
                  <span class="total-value ${previewBill.balance_due < 0 ? 'payment-paid' : 'payment-due'}">₹${Math.abs(previewBill.balance_due).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              `;
            }

            // Separator after previous balance/payments section
            if ((previewBill.previous_balance && previewBill.previous_balance > 0) || (previewBill.payments && previewBill.payments.length > 0)) {
              html += `<div class="separator"></div>`;
            }

            // Current Bill Items
            html += `
              <div class="total-row">
                <span class="total-label">Items Total:</span>
                <span class="total-value">₹${itemsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            `;

            // Other Charges
            if (previewBill.other_charges && previewBill.other_charges.length > 0) {
              previewBill.other_charges.forEach(charge => {
                const chargeName = charge.charge_type.charAt(0).toUpperCase() + charge.charge_type.slice(1);
                html += `
                  <div class="total-row charge-row">
                    <span class="charge-label">+ ${chargeName}${charge.description ? ` (${charge.description})` : ''}:</span>
                    <span class="charge-value">₹${charge.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                `;
              });
            }

            // Discount
            if (previewBill.discount > 0) {
              html += `
                <div class="total-row charge-row">
                  <span class="charge-label">- Discount:</span>
                  <span class="total-value payment-due">₹${previewBill.discount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              `;
            }

            // Current Bill Subtotal (if there are charges or discount)
            if (otherChargesTotal > 0 || previewBill.discount > 0) {
              html += `
                <div class="total-row">
                  <span class="total-label">Current Bill Subtotal:</span>
                  <span class="total-value">₹${(subtotal - previewBill.discount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              `;
            }

            // Grand Total
            html += `
              <div class="total-row grand-total">
                <span class="total-label">TOTAL DUE:</span>
                <span class="total-value">₹${previewBill.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            `;

            return html;
          })()}

          ${previewBill.notes ? `
          <div class="notes">
            <div class="notes-title">Notes:</div>
            <div class="notes-text">${previewBill.notes}</div>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="footer">
        <div class="footer-text">Thank you for your business!</div>
      </div>
    </body>
    </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      // On mobile, share the PDF
      if (Platform.OS !== 'web') {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Bill ${previewBill.bill_number}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } else {
        // On web, just print
        await Print.printAsync({ html: htmlContent });
      }
    } catch (err) {
      console.error('Error printing bill:', err);
      Alert.alert('Error', 'Failed to print/share bill');
    }
  };

  const { itemsTotal, chargesTotal, subtotal, quickPaymentsTotal, total } = calculateTotals();
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Bill Generation</Text>
      </View>

      {/* Date Picker */}
      <View style={styles.dateContainer}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>
          {new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Generate New Bill Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generate New Bill</Text>

          {/* Customer Selection */}
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Select Customer</Text>
            <Picker
              selectedValue={selectedCustomerId}
              onValueChange={handleCustomerSelect}
              style={styles.picker}
            >
              <Picker.Item label="Choose a customer..." value={null} />
              {customers.map((customer) => (
                <Picker.Item key={customer.id} label={customer.name} value={customer.id} />
              ))}
            </Picker>
          </View>

          {/* Check if bill already exists for this customer on this date */}
          {selectedCustomerId && (() => {
            const existingBill = bills.find(b => b.customer_id === selectedCustomerId && b.bill_date === date);
            if (existingBill) {
              const customer = customers.find(c => c.id === selectedCustomerId);
              return (
                <View style={styles.billExistsContainer}>
                  <Text style={styles.billExistsIcon}>✓</Text>
                  <Text style={styles.billExistsTitle}>Bill Already Generated</Text>
                  <Text style={styles.billExistsText}>
                    A bill ({existingBill.bill_number}) already exists for {customer?.name} on this date.
                  </Text>
                  <Text style={styles.billExistsSubtext}>
                    You can view, edit, or delete the existing bill from the "Generated Bills" section below.
                  </Text>
                </View>
              );
            }
            return null;
          })()}

          {/* Customer Outstanding Balance */}
          {selectedCustomerId && !bills.find(b => b.customer_id === selectedCustomerId && b.bill_date === date) && (
            <CustomerOutstandingCard
              totalOutstanding={customerOutstanding.total_outstanding}
              unpaidBillsCount={customerOutstanding.unpaid_bills_count}
              oldestBillDate={customerOutstanding.oldest_bill_date}
            />
          )}

          {/* Bill Items */}
          {selectedCustomerId && loadingItems && !bills.find(b => b.customer_id === selectedCustomerId && b.bill_date === date) && (
            <View style={styles.loadingItemsContainer}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>Loading items for {new Date(date).toLocaleDateString('en-IN')}...</Text>
            </View>
          )}

          {selectedCustomerId && !loadingItems && billItems.length > 0 && !bills.find(b => b.customer_id === selectedCustomerId && b.bill_date === date) && (
            <>
              <Text style={styles.subSectionTitle}>Bill Items</Text>

              {billItems.map((item, index) => {
                const qtyDisplay = `${item.quantity_crates} cr${item.quantity_kg > 0 ? ` + ${Math.round(item.quantity_kg)} kg` : ''}`;
                const weightDisplay = `${Math.round(item.total_weight)} kg`;
                const cratesDisplay = `${item.quantity_crates} cr`;

                return (
                  <View key={index} style={styles.billItemCard}>
                    {/* Item Name and Total Amount */}
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemNameLarge}>{item.fish_variety_name}</Text>
                      <Text style={styles.itemAmount}>₹{calculateItemAmount(item).toLocaleString('en-IN')}</Text>
                    </View>

                    <Text style={styles.itemQtyText}>{qtyDisplay}</Text>

                    {/* Row 1: Crate Weight × Crates → Total Weight */}
                    <View style={styles.itemDataRow}>
                      <View style={styles.dataGroup}>
                        <TextInput
                          style={styles.dataInputSubtle}
                          placeholder="35"
                          keyboardType="numeric"
                          value={item.crate_weight.toString()}
                          onChangeText={(value) => updateItemField(index, 'crate_weight', value)}
                        />
                        <Text style={styles.dataLabel}>kg/crate</Text>
                      </View>

                      <Text style={styles.dataArrow}>×</Text>

                      <View style={styles.dataGroup}>
                        <Text style={styles.dataValueSubtle}>{cratesDisplay}</Text>
                        <Text style={styles.dataLabel}>Crates</Text>
                      </View>

                      <Text style={styles.dataArrow}>→</Text>

                      <View style={styles.dataGroup}>
                        <Text style={styles.dataValue}>{weightDisplay}</Text>
                        <Text style={styles.dataLabel}>Total</Text>
                      </View>
                    </View>

                    {/* Row 2: Price × Total Weight */}
                    <View style={styles.itemDataRow}>
                      <View style={styles.dataGroupPrice}>
                        <TextInput
                          style={styles.dataInputPrice}
                          placeholder="0"
                          keyboardType="numeric"
                          value={item.rate_per_kg.toString()}
                          onChangeText={(value) => updateItemField(index, 'rate_per_kg', value)}
                        />
                        <Text style={styles.dataLabelPrice}>₹/kg</Text>
                      </View>

                      <Text style={styles.dataArrowPrice}>×</Text>

                      <View style={styles.dataGroup}>
                        <Text style={styles.dataValue}>{weightDisplay}</Text>
                        <Text style={styles.dataLabel}>Weight</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Other Charges Section */}
              <OtherChargesSection
                charges={otherCharges}
                onChargesChange={setOtherCharges}
              />

              {/* Quick Payments Section */}
              <View style={styles.quickPaymentsContainer}>
                <Text style={styles.label}>💰 Record Payments (Optional)</Text>
                <Text style={styles.helpText}>Add payments received to include in this bill</Text>

                {quickPayments.map((payment, index) => (
                  <View key={index} style={styles.paymentItem}>
                    <View style={styles.paymentItemLeft}>
                      <Text style={styles.paymentItemAmount}>₹{payment.amount.toLocaleString('en-IN')}</Text>
                      <Text style={styles.paymentItemDetails}>
                        {payment.payment_method.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveQuickPayment(index)} style={styles.removePaymentBtn}>
                      <Text style={styles.removePaymentText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addPaymentRow}>
                  <TextInput
                    style={[styles.input, styles.paymentAmountInput]}
                    placeholder="Enter amount"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newPaymentAmount}
                    onChangeText={setNewPaymentAmount}
                  />
                  <View style={styles.paymentMethodPicker}>
                    <Picker
                      selectedValue={newPaymentMethod}
                      onValueChange={setNewPaymentMethod}
                      style={styles.miniPicker}
                    >
                      <Picker.Item label="Cash" value="cash" />
                      <Picker.Item label="UPI" value="upi" />
                      <Picker.Item label="Bank" value="bank_transfer" />
                      <Picker.Item label="Cheque" value="cheque" />
                    </Picker>
                  </View>
                  <TouchableOpacity onPress={handleAddQuickPayment} style={styles.addPaymentBtn}>
                    <Text style={styles.addPaymentText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.notesContainer}>
                <Text style={styles.label}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="Add any notes..."
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              {/* Totals */}
              <View style={styles.totalsCard}>
                {/* Previous Balance */}
                {previewPreviousBalance > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Previous Balance:</Text>
                    <Text style={styles.totalValue}>₹{previewPreviousBalance.toLocaleString('en-IN')}</Text>
                  </View>
                )}

                {/* Payments Received */}
                {previewPayments.length > 0 && (
                  <>
                    <Text style={styles.paymentsSectionTitle}>Payments Received:</Text>
                    {previewPayments.map((payment, index) => (
                      <View key={index} style={[styles.totalRow, styles.paymentRow]}>
                        <Text style={styles.paymentLabel}>
                          {new Date(payment.payment_date).toLocaleDateString('en-IN')} - {payment.payment_method.toUpperCase()}:
                        </Text>
                        <Text style={styles.paymentValue}>-₹{payment.amount.toLocaleString('en-IN')}</Text>
                      </View>
                    ))}
                    <View style={[styles.totalRow, styles.subtotalRow]}>
                      <Text style={styles.totalLabel}>Outstanding:</Text>
                      <Text style={styles.totalValue}>₹{previewBalanceDue.toLocaleString('en-IN')}</Text>
                    </View>
                  </>
                )}

                {/* Separator if there's previous data */}
                {(previewPreviousBalance > 0 || previewPayments.length > 0) && (
                  <View style={styles.separator} />
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Items Total:</Text>
                  <Text style={styles.totalValue}>₹{itemsTotal.toLocaleString('en-IN')}</Text>
                </View>
                {chargesTotal !== 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Other Charges:</Text>
                    <Text style={[styles.totalValue, chargesTotal < 0 ? styles.negativeValue : null]}>
                      {chargesTotal > 0 ? '+' : ''}₹{chargesTotal.toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal:</Text>
                  <Text style={styles.totalValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
                </View>

                {/* Quick Payments to be recorded */}
                {quickPayments.length > 0 && (
                  <>
                    <Text style={styles.paymentsSectionTitle}>Payments Being Recorded Today:</Text>
                    {quickPayments.map((payment, index) => (
                      <View key={index} style={[styles.totalRow, styles.paymentRow]}>
                        <Text style={styles.paymentLabel}>
                          {payment.payment_method.toUpperCase()}:
                        </Text>
                        <Text style={styles.paymentValue}>-₹{payment.amount.toLocaleString('en-IN')}</Text>
                      </View>
                    ))}
                  </>
                )}

                <View style={[styles.totalRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Bill Total:</Text>
                  <Text style={styles.grandTotalValue}>₹{total.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              {/* Mark as Paid Option */}
              <TouchableOpacity
                onPress={() => setMarkAsPaid(!markAsPaid)}
                style={styles.markAsPaidContainer}
              >
                <View style={styles.checkboxContainer}>
                  <View style={[styles.checkbox, markAsPaid ? styles.checkboxChecked : null]}>
                    {markAsPaid && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.markAsPaidTextContainer}>
                    <Text style={styles.markAsPaidText}>Mark as Fully Paid</Text>
                    <Text style={styles.markAsPaidSubtext}>
                      Customer paid the full bill amount today
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Action Button */}
              <TouchableOpacity
                onPress={() => handleGenerateBill(false)}
                disabled={submitting}
                style={[styles.generateBillButton, submitting ? styles.buttonDisabled : null]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <>
                    <Text style={styles.generateBillButtonText}>
                      {markAsPaid ? '✅ Generate Paid Bill' : quickPayments.length > 0 ? '💾 Generate Bill & Save Payments' : '💾 Generate Bill'}
                    </Text>
                    <Text style={styles.generateBillSubtext}>
                      {markAsPaid
                        ? 'Bill will be marked as paid'
                        : quickPayments.length > 0
                        ? `${quickPayments.length} payment(s) will be recorded`
                        : 'Save bill as unpaid'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {selectedCustomerId && billItems.length === 0 && (
            <Text style={styles.emptyText}>No sales found for this customer on {new Date(date).toLocaleDateString('en-IN')}</Text>
          )}
        </View>

        {/* Generated Bills Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generated Bills</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
          ) : bills.length === 0 ? (
            <Text style={styles.emptyText}>No bills generated for this date</Text>
          ) : (
            bills.map((bill) => {
              const customer = customers.find(c => c.id === bill.customer_id);
              const billTotal = typeof bill.total === 'number' ? bill.total : parseFloat(bill.total || '0');
              const billDate = new Date(bill.bill_date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
              return (
                <View key={bill.id} style={styles.billCard}>
                  <View style={styles.billHeader}>
                    <View style={styles.billHeaderLeft}>
                      <Text style={styles.billNumber}>{bill.bill_number}</Text>
                      <Text style={styles.billCustomer}>{customer?.name || 'Unknown'}</Text>
                      <Text style={styles.billDate}>{billDate}</Text>
                    </View>
                    <Text style={styles.billTotal}>₹{billTotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.billActions}>
                    <TouchableOpacity
                      onPress={() => handleViewBill(bill.id)}
                      style={styles.viewButton}
                    >
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleEditBill(bill.id)}
                      style={styles.editButton}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteBill(bill.id, bill.bill_number)}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bill Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bill Preview</Text>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {previewBill && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.billPreview}>
                {/* Business Header */}
                <View style={styles.businessHeader}>
                  <View style={styles.headerTopRow}>
                    <Text style={styles.proprietorText}>Ibrahim Shaik (IB-NLR)</Text>
                    <Text style={styles.contactText}>📞 99087 04047</Text>
                  </View>
                  <Text style={styles.companyNameMain}>S.K.S. Co.</Text>
                  <Text style={styles.businessTagline}>Wholesale Fish & Prawn Trading</Text>
                  <Text style={styles.addressText}>Raghavendra Ice Factory, Muttukur Road, Nellore, AP.</Text>
                </View>

                <View style={styles.customerInfo}>
                  <View style={styles.customerRow}>
                    <View style={styles.customerLeft}>
                      <Text style={styles.customerNameBig}>
                        {customers.find(c => c.id === previewBill.customer_id)?.name || 'Unknown'}
                      </Text>
                      <Text style={styles.totalBoxesText}>
                        Total: {(previewBill.items || []).reduce((sum, item) => sum + item.quantity_crates, 0)} boxes
                      </Text>
                    </View>
                    <View style={styles.customerRight}>
                      <Text style={styles.billNumberText}>{previewBill.bill_number}</Text>
                      <Text style={styles.billDateText}>
                        {new Date(previewBill.bill_date).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.itemsTable}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.itemColumnWide]}>Item</Text>
                    <Text style={[styles.tableHeaderText, styles.weightColumn]}>Weight{'\n'}(kg)</Text>
                    <Text style={[styles.tableHeaderText, styles.rateColumn]}>Rate{'\n'}(₹/kg)</Text>
                    <Text style={[styles.tableHeaderText, styles.amountColumn]}>Amount{'\n'}(₹)</Text>
                  </View>
                  {(previewBill.items || []).map((item, index) => {
                    const crateWeight = 35; // kg per crate
                    const totalWeight = (item.quantity_crates * crateWeight) + item.quantity_kg;
                    const qtyText = [
                      item.quantity_crates > 0 && `${item.quantity_crates} cr`,
                      item.quantity_kg > 0 && `${item.quantity_kg} kg`
                    ].filter(Boolean).join(' + ') || '0 kg';

                    return (
                      <View key={index} style={styles.tableRow}>
                        <View style={styles.itemColumnWide}>
                          <Text style={styles.tableCellText}>{item.fish_variety_name}</Text>
                          <Text style={styles.qtySubtext}>{qtyText}</Text>
                        </View>
                        <Text style={[styles.tableCellText, styles.weightColumn]}>
                          {totalWeight.toFixed(2)}
                        </Text>
                        <Text style={[styles.tableCellText, styles.rateColumn]}>
                          {item.rate_per_kg}
                        </Text>
                        <Text style={[styles.tableCellText, styles.amountColumn]}>{item.amount.toFixed(2)}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.billTotals}>
                  {/* Previous Balance */}
                  {previewBill.previous_balance > 0 && (
                    <View style={styles.billTotalRow}>
                      <Text style={styles.billTotalLabel}>Previous Balance:</Text>
                      <Text style={styles.billTotalValue}>₹{previewBill.previous_balance.toFixed(2)}</Text>
                    </View>
                  )}

                  {/* Payments Received */}
                  {previewBill.payments && previewBill.payments.length > 0 && (
                    <>
                      <Text style={styles.paymentsSectionTitle}>Less: Payments Received</Text>
                      {previewBill.payments.map((payment, index) => (
                        <View key={index} style={[styles.billTotalRow, styles.paymentRow]}>
                          <Text style={styles.paymentLabel}>
                            {new Date(payment.payment_date).toLocaleDateString('en-IN')} - {payment.payment_method.toUpperCase()}
                          </Text>
                          <Text style={styles.paymentValue}>₹{payment.amount.toFixed(2)}</Text>
                        </View>
                      ))}
                      <View style={[styles.billTotalRow, styles.subtotalRow]}>
                        <Text style={styles.billTotalLabel}>
                          {previewBill.balance_due < 0 ? 'Credit Balance:' : 'Balance Outstanding:'}
                        </Text>
                        <Text style={[styles.billTotalValue, previewBill.balance_due < 0 ? styles.creditBalance : null]}>
                          ₹{Math.abs(previewBill.balance_due).toFixed(2)}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Separator */}
                  {(previewBill.previous_balance > 0 || (previewBill.payments && previewBill.payments.length > 0)) && (
                    <View style={styles.separator} />
                  )}

                  {/* Items Total */}
                  <View style={styles.billTotalRow}>
                    <Text style={styles.billTotalLabel}>Items Total:</Text>
                    <Text style={styles.billTotalValue}>
                      ₹{(previewBill.items || []).reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </Text>
                  </View>

                  {/* Other Charges */}
                  {previewBill.other_charges && previewBill.other_charges.length > 0 && (
                    <>
                      {previewBill.other_charges.map((charge, index) => (
                        <View key={index} style={[styles.billTotalRow, styles.chargeRow]}>
                          <Text style={styles.chargeLabel}>
                            + {charge.charge_type.charAt(0).toUpperCase() + charge.charge_type.slice(1)}
                            {charge.description ? ` (${charge.description})` : ''}
                          </Text>
                          <Text style={styles.chargeValue}>₹{charge.amount.toFixed(2)}</Text>
                        </View>
                      ))}
                      <View style={[styles.billTotalRow, styles.subtotalRow]}>
                        <Text style={styles.billTotalLabel}>Subtotal:</Text>
                        <Text style={styles.billTotalValue}>₹{previewBill.subtotal.toFixed(2)}</Text>
                      </View>
                    </>
                  )}

                  {/* Discount */}
                  {previewBill.discount > 0 && (
                    <View style={styles.billTotalRow}>
                      <Text style={styles.billTotalLabel}>Less: Discount</Text>
                      <Text style={styles.billTotalValue}>₹{previewBill.discount.toFixed(2)}</Text>
                    </View>
                  )}

                  {/* Grand Total */}
                  <View style={[styles.billTotalRow, styles.grandTotal]}>
                    <Text style={styles.billGrandTotalLabel}>TOTAL DUE:</Text>
                    <Text style={styles.billGrandTotalValue}>₹{previewBill.total.toFixed(2)}</Text>
                  </View>
                </View>

                {previewBill.notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesTitle}>Notes:</Text>
                    <Text style={styles.notesText}>{previewBill.notes}</Text>
                  </View>
                )}

                {/* Footer */}
                <View style={styles.billFooter}>
                  <Text style={styles.footerText}>Thank you for your business!</Text>
                </View>
              </View>

              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity onPress={handlePrintBill} style={styles.printButton}>
                  <Text style={styles.printButtonText}>📄 Print/Save as PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShareBill} style={styles.shareButton}>
                  <Text style={styles.shareButtonText}>📱 Share as Text</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Payment Dialog */}
      {selectedCustomerId && (
        <PaymentDialog
          visible={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setCreatedBillId(null);
          }}
          onSuccess={async () => {
            resetForm();
            await loadData();
          }}
          customerId={selectedCustomerId}
          customerName={selectedCustomer?.name || ''}
          initialAmount={total}
          newBillId={createdBillId}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#3B82F6',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateButton: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  dateButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 12,
  },
  todayButton: {
    padding: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    marginLeft: 8,
  },
  todayButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 12,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  billItemCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  weightRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  weightInputGroup: {
    flex: 1,
  },
  totalWeightDisplay: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  totalWeightLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  totalWeightValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  rateRowSingle: {
    marginBottom: 12,
  },
  rateInputFull: {
    width: '100%',
  },
  rateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  rateInput: {
    flex: 1,
  },
  rateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  calculationHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'right',
  },
  // New Compact Styles
  weightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  weightInputCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  compactLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  compactInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    minWidth: 35,
    textAlign: 'center',
    padding: 0,
  },
  unitText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  totalWeightCompact: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  totalWeightValueCompact: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 2,
  },
  totalWeightBreakdown: {
    fontSize: 11,
    color: '#60A5FA',
  },
  rateAmountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rateInputCompact: {
    flex: 1,
  },
  rateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
  },
  rupeeSymbol: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 4,
  },
  compactInputRate: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    padding: 0,
  },
  amountCompact: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  amountLabelCompact: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    marginBottom: 2,
  },
  amountValueCompact: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#15803D',
  },
  // Two-row Card Layout for Bill Items
  itemNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemNameLarge: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  itemAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  itemQtyText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  itemDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dataGroup: {
    flex: 1,
    alignItems: 'center',
  },
  dataGroupPrice: {
    flex: 1.5,
    alignItems: 'center',
  },
  // Subtle crate weight input (less emphasized)
  dataInputSubtle: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    minWidth: 50,
    marginBottom: 4,
  },
  // Highlighted price input (most important)
  dataInputPrice: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: 'bold',
    color: '#92400E',
    textAlign: 'center',
    minWidth: 70,
    marginBottom: 4,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  dataLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  dataLabelPrice: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '700',
  },
  dataValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  dataValueSubtle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  dataArrow: {
    fontSize: 16,
    color: '#D1D5DB',
    marginHorizontal: 6,
  },
  dataArrowPrice: {
    fontSize: 20,
    color: '#F59E0B',
    marginHorizontal: 10,
    fontWeight: 'bold',
  },
  // Adjustments
  balanceContainer: {
    marginTop: 16,
  },
  balanceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  balanceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    padding: 0,
    marginLeft: 6,
  },
  quickPaymentsContainer: {
    marginTop: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  helpText: {
    fontSize: 13,
    color: '#15803D',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  paymentItemLeft: {
    flex: 1,
  },
  paymentItemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 2,
  },
  paymentItemDetails: {
    fontSize: 12,
    color: '#16A34A',
  },
  removePaymentBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePaymentText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addPaymentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  paymentAmountInput: {
    flex: 3,
  },
  paymentMethodPicker: {
    flex: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    justifyContent: 'center',
  },
  miniPicker: {
    height: 42,
  },
  addPaymentBtn: {
    width: 44,
    backgroundColor: '#10B981',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPaymentText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  negativeValue: {
    color: '#DC2626',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  discountContainer: {
    marginTop: 16,
  },
  notesContainer: {
    marginTop: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  totalsCard: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#374151',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#3B82F6',
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  markAsPaidContainer: {
    marginTop: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#92400E',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  markAsPaidTextContainer: {
    flex: 1,
  },
  markAsPaidText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 2,
  },
  markAsPaidSubtext: {
    fontSize: 13,
    color: '#78350F',
  },
  generateBillButton: {
    backgroundColor: '#10B981',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  generateBillButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  generateBillSubtext: {
    fontSize: 13,
    color: '#D1FAE5',
    marginTop: 2,
  },
  generateButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  loader: {
    marginVertical: 20,
  },
  billCard: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  billNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  billCustomer: {
    fontSize: 14,
    color: '#6B7280',
  },
  billTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  billActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#3B82F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  billPreview: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  businessHeader: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 0,
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#0EA5E9',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  companyNameMain: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  proprietorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  contactText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  businessTagline: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
    textAlign: 'center',
    marginBottom: 20,
  },
  customerInfo: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerLeft: {
    flex: 1,
  },
  customerRight: {
    alignItems: 'flex-end',
  },
  customerNameBig: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  totalBoxesText: {
    fontSize: 11,
    color: '#6B7280',
  },
  billNumberText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  billDateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemsTable: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 14,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableCellText: {
    fontSize: 13,
    color: '#111827',
  },
  itemColumn: {
    flex: 2,
  },
  itemColumnWide: {
    flex: 2.5,
  },
  qtySubtext: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  qtyColumn: {
    flex: 1.2,
    textAlign: 'center',
  },
  weightColumn: {
    flex: 1.2,
    textAlign: 'center',
  },
  rateColumn: {
    flex: 1.2,
    textAlign: 'center',
  },
  amountColumn: {
    flex: 1.5,
    textAlign: 'right',
  },
  billTotals: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billTotalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  billTotalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  chargeRow: {
    paddingLeft: 16,
  },
  chargeLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: 'normal',
  },
  chargeValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#059669',
  },
  subtotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paymentsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginTop: 8,
    marginBottom: 4,
  },
  paymentRow: {
    paddingLeft: 12,
  },
  paymentLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: 'normal',
  },
  paymentValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  creditBalance: {
    color: '#10B981',
  },
  separator: {
    height: 2,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  grandTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#3B82F6',
  },
  billGrandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  billGrandTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  notesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
  },
  billFooter: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  printButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  printButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  loadingItemsContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#15803D',
    fontWeight: '500',
  },
  billExistsContainer: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
  },
  billExistsIcon: {
    fontSize: 48,
    color: '#3B82F6',
    marginBottom: 12,
  },
  billExistsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  billExistsText: {
    fontSize: 14,
    color: '#1E40AF',
    textAlign: 'center',
    marginBottom: 8,
  },
  billExistsSubtext: {
    fontSize: 13,
    color: '#3B82F6',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  billHeaderLeft: {
    flex: 1,
  },
  billDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
