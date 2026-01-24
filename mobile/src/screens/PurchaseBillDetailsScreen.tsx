import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getPurchaseBillDetails, createPurchaseBillPayment, deletePurchaseBillPayment } from '../api/stock';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type PurchaseBillDetailsRouteProp = RouteProp<RootStackParamList, 'PurchaseBillDetails'>;

type BillItem = {
  id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  actual_weight: number;
  billable_weight: number;
  rate_per_kg: number;
  amount: number;
};

type Payment = {
  id: number;
  payment_date: string;
  amount: number;
  payment_mode: string;
  notes?: string;
};

type OtherDeduction = {
  type: string;
  amount: number;
};

type BillDetails = {
  id: number;
  bill_number: string;
  farmer_id: number;
  farmer_name: string;
  bill_date: string;
  gross_amount: number;
  weight_deduction_percentage: number;
  weight_deduction_amount: number;
  subtotal: number;
  commission_per_kg: number;
  commission_amount: number;
  other_deductions: OtherDeduction[];
  other_deductions_total: number;
  total: number;
  payment_status: string;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  location?: string;
  secondary_name?: string;
  items: BillItem[];
  payments: Payment[];
};

export default function PurchaseBillDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<PurchaseBillDetailsRouteProp>();
  const { billId } = route.params;

  const [billDetails, setBillDetails] = useState<BillDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    loadBillDetails();
  }, []);

  const loadBillDetails = async () => {
    setLoading(true);
    try {
      const data = await getPurchaseBillDetails(billId);
      setBillDetails(data);
    } catch (error) {
      console.error('Error loading bill details:', error);
      Alert.alert('Error', 'Failed to load bill details');
    } finally {
      setLoading(false);
    }
  };

  const generatePrintableHTML = (bill: BillDetails): string => {
    const itemsHTML = bill.items.map((item) => {
      let qtyText = '';
      if (item.quantity_crates > 0 && item.quantity_kg > 0) {
        qtyText = `${item.quantity_crates}+${item.quantity_kg}kg`;
      } else if (item.quantity_crates > 0) {
        qtyText = `${item.quantity_crates} cr`;
      } else if (item.quantity_kg > 0) {
        qtyText = `${item.quantity_kg} kg`;
      } else {
        qtyText = '0 kg';
      }

      return `
      <tr>
        <td>${item.fish_variety_name}</td>
        <td class="text-center">${qtyText}</td>
        <td class="text-center">${item.billable_weight}</td>
        <td class="text-center">${item.rate_per_kg}</td>
        <td class="text-right">${item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
      </tr>
      `;
    }).join('');

    const otherDeductionsHTML = bill.other_deductions.map((deduction) => {
      const isAddition = deduction.type === 'other_charges_addition';

      let displayName = '';
      if (deduction.type === 'other_charges_addition') {
        displayName = 'Other charges (+)';
      } else if (deduction.type === 'other_charges_deduction') {
        displayName = 'Other charges (-)';
      } else {
        displayName = deduction.type.charAt(0).toUpperCase() + deduction.type.slice(1).replace(/_/g, ' ');
      }

      const prefix = isAddition ? '+' : '-';
      const cssClass = isAddition ? 'charge-value' : 'deduction-value';

      return `
        <div class="total-row charge-row">
          <span class="total-label charge-label">${prefix} ${displayName}:</span>
          <span class="total-value ${cssClass}">${deduction.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      `;
    }).join('');

    const paymentsHTML = bill.payments.length > 0 ? bill.payments.map((payment) => `
      <tr>
        <td>${new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td class="text-center">${payment.payment_mode.toUpperCase()}</td>
        <td class="text-right payment-amount-cell">₹${payment.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
        ${payment.notes ? `<td class="payment-notes-cell">${payment.notes}</td>` : '<td class="payment-notes-cell">-</td>'}
      </tr>
    `).join('') : '';

    return `
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
              position: relative;
            }
            .content-wrapper::before {
              content: "🐟";
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 300px;
              opacity: 0.03;
              z-index: 0;
              pointer-events: none;
            }
            .header {
              background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
              padding: 10px 16px;
              border-bottom: 3px solid #0ea5e9;
              margin-bottom: 10px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              position: relative;
              z-index: 1;
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
              font-size: 13px;
            }
            .contact {
              color: #0284c7;
              font-weight: 800;
              font-size: 14px;
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
            .farmer-section {
              margin-bottom: 10px;
              padding: 10px;
              background: #f9fafb;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              position: relative;
              z-index: 1;
            }
            .farmer-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .farmer-left {
              flex: 1;
            }
            .farmer-right {
              text-align: right;
              background: #fff;
              padding: 8px 12px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            .farmer-name {
              font-size: 16px;
              font-weight: 800;
              color: #111827;
              margin-bottom: 2px;
            }
            .farmer-details {
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
              position: relative;
              z-index: 1;
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
            }
            tbody tr:nth-child(even) td {
              background: #f9fafb;
            }
            tbody tr:hover td {
              background: #f0f9ff;
            }
            .qty-subtext {
              font-size: 11px;
              color: #6b7280;
              margin-top: 2px;
              font-weight: 500;
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
              position: relative;
              z-index: 1;
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
              padding-left: 16px;
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
            .deduction-value {
              font-size: 12px;
              color: #DC2626;
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
              margin-top: 16px;
              padding-top: 12px;
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
            .payment-details-section {
              margin-top: 10px;
              padding: 10px;
              background: #f8fafc;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              position: relative;
              z-index: 1;
            }
            .payment-details-title {
              font-size: 12px;
              font-weight: 700;
              color: #374151;
              margin-bottom: 6px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              border-bottom: 2px solid #0ea5e9;
              padding-bottom: 3px;
            }
            .payment-table {
              width: 100%;
              border-collapse: collapse;
              margin: 0;
              background: #fff;
            }
            .payment-table thead {
              background: linear-gradient(to bottom, #0ea5e9, #0284c7);
            }
            .payment-table th {
              padding: 5px 4px;
              text-align: left;
              font-size: 10px;
              font-weight: 700;
              color: #ffffff;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .payment-table td {
              padding: 5px 4px;
              font-size: 11px;
              color: #111827;
              border-bottom: 1px solid #e5e7eb;
              background: #ffffff;
            }
            .payment-table tbody tr:nth-child(even) td {
              background: #f9fafb;
            }
            .payment-amount-cell {
              font-weight: 700;
              color: #059669;
            }
            .payment-notes-cell {
              font-size: 9px;
              color: #6b7280;
              font-style: italic;
            }
            .payment-space {
              margin-top: 15px;
              padding: 12px;
              border: 2px dashed #d1d5db;
              border-radius: 6px;
              background: #fafafa;
              min-height: 60px;
            }
            .payment-space-title {
              font-size: 10px;
              font-weight: 700;
              color: #374151;
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .payment-space-subtitle {
              font-size: 9px;
              color: #6b7280;
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

            <div class="farmer-section">
            <div class="farmer-row">
              <div class="farmer-left">
                <div class="farmer-name">${bill.farmer_name}</div>
                ${(bill.location || bill.secondary_name) ? `
                  <div class="farmer-details">
                    ${bill.location ? bill.location : ''}
                    ${bill.location && bill.secondary_name ? ' • ' : ''}
                    ${bill.secondary_name ? bill.secondary_name : ''}
                  </div>
                ` : ''}
              </div>
              <div class="farmer-right">
                <div class="bill-number">${bill.bill_number}</div>
                <div class="bill-date">${new Date(bill.bill_date).toLocaleDateString('en-IN')}</div>
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
              ${itemsHTML}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span class="total-label">Subtotal (₹):</span>
              <span class="total-value">${bill.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>

            <div class="total-row charge-row">
              <span class="total-label charge-label">+ Commission:</span>
              <span class="total-value charge-value">${bill.commission_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>

            ${otherDeductionsHTML}

            <div class="total-row grand-total">
              <span class="total-label">TOTAL DUE (₹):</span>
              <span class="total-value">${bill.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>

            ${bill.payments.length > 0 ? `
              <div class="separator"></div>

              <div class="total-row">
                <span class="total-label">Amount Paid (₹):</span>
                <span class="total-value payment-paid">${bill.amount_paid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>

              <div class="total-row">
                <span class="total-label">Balance Due (₹):</span>
                <span class="total-value payment-due">${bill.balance_due.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            ` : ''}
          </div>

            ${bill.payments.length > 0 ? `
            <div class="payment-details-section">
              <div class="payment-details-title">Payment Details</div>
              <table class="payment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th class="text-center">Mode</th>
                    <th class="text-right">Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${paymentsHTML}
                </tbody>
              </table>
            </div>
            ` : ''}

            ${bill.notes ? `
            <div class="notes">
              <div class="notes-title">Notes:</div>
              <div class="notes-text">${bill.notes}</div>
            </div>
            ` : ''}

            <div class="payment-space">
              <div class="payment-space-title">Payment Records</div>
              <div class="payment-space-subtitle">Use this space to record payment details manually</div>
            </div>
          </div>

          <div class="footer">
            <div class="footer-text">
              Thank you for your business!
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (!billDetails) return;

    try {
      const html = generatePrintableHTML(billDetails);

      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Purchase Bill - ${billDetails.bill_number}`,
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Success', 'Bill has been generated and saved');
      }
    } catch (error) {
      console.error('Error printing bill:', error);
      Alert.alert('Error', 'Failed to generate printable bill');
    }
  };

  const handleOpenPaymentModal = () => {
    if (!billDetails) return;
    setPaymentAmount(billDetails.balance_due.toString());
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('cash');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleAddPayment = async () => {
    if (!billDetails) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (amount > billDetails.balance_due) {
      Alert.alert('Error', `Payment amount cannot exceed balance due (₹${billDetails.balance_due.toLocaleString('en-IN')})`);
      return;
    }

    setSubmittingPayment(true);
    try {
      await createPurchaseBillPayment(
        billDetails.id,
        paymentDate,
        amount,
        paymentMode,
        paymentNotes
      );

      Alert.alert('Success', 'Payment recorded successfully');
      setShowPaymentModal(false);
      await loadBillDetails(); // Reload to get updated data
    } catch (error) {
      console.error('Error adding payment:', error);
      Alert.alert('Error', 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePurchaseBillPayment(paymentId);
              Alert.alert('Success', 'Payment deleted successfully');
              await loadBillDetails();
            } catch (error) {
              console.error('Error deleting payment:', error);
              Alert.alert('Error', 'Failed to delete payment');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading bill details...</Text>
      </View>
    );
  }

  if (!billDetails) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Bill not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill Details</Text>
        <TouchableOpacity onPress={handlePrint} style={styles.printButton}>
          <Text style={styles.printButtonText}>Print</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Bill Header */}
        <View style={styles.billHeader}>
          <View style={styles.billHeaderRow}>
            <Text style={styles.billNumber}>{billDetails.bill_number}</Text>
            <View style={[
              styles.statusBadge,
              billDetails.payment_status === 'paid' && styles.statusPaid,
              billDetails.payment_status === 'pending' && styles.statusPending,
              billDetails.payment_status === 'partial' && styles.statusPartial,
            ]}>
              <Text style={[
                styles.statusText,
                billDetails.payment_status === 'paid' && styles.statusTextPaid,
                billDetails.payment_status === 'pending' && styles.statusTextPending,
                billDetails.payment_status === 'partial' && styles.statusTextPartial,
              ]}>
                {billDetails.payment_status === 'paid' && 'Paid'}
                {billDetails.payment_status === 'pending' && 'Pending'}
                {billDetails.payment_status === 'partial' && 'Partial'}
              </Text>
            </View>
          </View>
          <Text style={styles.farmerName}>{billDetails.farmer_name}</Text>
          {(billDetails.location || billDetails.secondary_name) && (
            <Text style={styles.billSubtitle}>
              {billDetails.location && billDetails.location}
              {billDetails.location && billDetails.secondary_name && ' • '}
              {billDetails.secondary_name && billDetails.secondary_name}
            </Text>
          )}
          <Text style={styles.billDate}>
            Date: {new Date(billDetails.bill_date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </Text>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {billDetails.items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.fish_variety_name}</Text>
                <Text style={styles.itemAmount}>
                  ₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
              </View>
              <View style={styles.itemMainInfo}>
                <Text style={styles.itemMainText}>
                  {item.billable_weight} kg × ₹{item.rate_per_kg}/kg
                </Text>
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemDetailText}>
                  {item.quantity_crates} cr × 35 kg + {item.quantity_kg} kg = {item.actual_weight} kg
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bill Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>
                ₹{billDetails.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Commission
              </Text>
              <Text style={styles.summaryValueAdd}>
                +₹{billDetails.commission_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            {billDetails.other_deductions.map((deduction, index) => {
              const isAddition = deduction.type === 'other_charges_addition';
              const isDeduction = deduction.type === 'other_charges_deduction';

              let displayName = '';
              if (deduction.type === 'other_charges_addition') {
                displayName = 'Other charges (+)';
              } else if (deduction.type === 'other_charges_deduction') {
                displayName = 'Other charges (-)';
              } else {
                displayName = deduction.type.charAt(0).toUpperCase() + deduction.type.slice(1).replace(/_/g, ' ');
              }

              return (
                <View key={index} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {displayName}
                  </Text>
                  <Text style={isAddition ? styles.summaryValueAdd : styles.summaryValueDeduction}>
                    {isAddition ? '+' : '-'}₹{deduction.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              );
            })}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Bill Amount</Text>
              <Text style={styles.totalValue}>
                ₹{billDetails.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.paymentSummaryCard}>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryLabel}>Amount Paid</Text>
              <Text style={styles.paymentSummaryPaid}>
                ₹{billDetails.amount_paid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryLabel}>Balance Due</Text>
              <Text style={styles.paymentSummaryDue}>
                ₹{billDetails.balance_due.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Payments Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payments</Text>
            {billDetails.balance_due > 0 && (
              <TouchableOpacity
                style={styles.addPaymentButton}
                onPress={handleOpenPaymentModal}
              >
                <Text style={styles.addPaymentText}>+ Add Payment</Text>
              </TouchableOpacity>
            )}
          </View>
          {billDetails.payments.length === 0 ? (
            <View style={styles.noPaymentsContainer}>
              <Text style={styles.noPaymentsText}>No payments recorded yet</Text>
            </View>
          ) : (
            billDetails.payments.map((payment) => (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentLeft}>
                    <Text style={styles.paymentAmount}>
                      ₹{payment.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={styles.paymentMode}>
                      {payment.payment_mode.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentDate}>
                      {new Date(payment.payment_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                    <TouchableOpacity
                      style={styles.deletePaymentButton}
                      onPress={() => handleDeletePayment(payment.id)}
                    >
                      <Text style={styles.deletePaymentText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {payment.notes && (
                  <Text style={styles.paymentNotes}>{payment.notes}</Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Notes Section */}
        {billDetails.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{billDetails.notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter amount"
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Date</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="YYYY-MM-DD"
                  value={paymentDate}
                  onChangeText={setPaymentDate}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Mode</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={paymentMode}
                    onValueChange={(value) => setPaymentMode(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Cash" value="cash" />
                    <Picker.Item label="Bank Transfer" value="bank_transfer" />
                    <Picker.Item label="UPI" value="upi" />
                    <Picker.Item label="Cheque" value="cheque" />
                    <Picker.Item label="Other" value="other" />
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Add notes (e.g., Transaction ID, Cheque No, etc.)..."
                  multiline
                  numberOfLines={4}
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submittingPayment && styles.submitButtonDisabled]}
                onPress={handleAddPayment}
                disabled={submittingPayment}
              >
                {submittingPayment ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Record Payment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  errorText: {
    fontSize: 18,
    color: '#DC2626',
    marginBottom: 12,
  },
  backLink: {
    fontSize: 16,
    color: '#0EA5E9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 50,
  },
  backButton: {
    fontSize: 16,
    color: '#0EA5E9',
    width: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  printButton: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  printButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  billHeader: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPartial: {
    backgroundColor: '#DBEAFE',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusTextPaid: {
    color: '#065F46',
  },
  statusTextPending: {
    color: '#92400E',
  },
  statusTextPartial: {
    color: '#1E40AF',
  },
  farmerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  billSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  billDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  addPaymentButton: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addPaymentText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  itemMainInfo: {
    marginBottom: 6,
  },
  itemMainText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  itemDetails: {
    gap: 4,
  },
  itemDetailText: {
    fontSize: 13,
    color: '#6B7280',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  subtotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
    paddingTop: 12,
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: '#D1D5DB',
    marginTop: 8,
    paddingTop: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryLabelBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  summaryValue: {
    fontSize: 14,
    color: '#374151',
  },
  summaryValueBold: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  summaryValueDeduction: {
    fontSize: 14,
    color: '#DC2626',
  },
  summaryValueAdd: {
    fontSize: 14,
    color: '#059669',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  paymentSummaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  paymentSummaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  paymentSummaryPaid: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  paymentSummaryDue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
  noPaymentsContainer: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noPaymentsText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  paymentCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 2,
  },
  paymentMode: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  paymentDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  paymentNotes: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  notesCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  paymentLeft: {
    flex: 1,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  deletePaymentButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  deletePaymentText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    fontSize: 28,
    color: '#6B7280',
    fontWeight: '300',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  formTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#0EA5E9',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
