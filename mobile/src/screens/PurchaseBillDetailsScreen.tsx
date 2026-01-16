import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getPurchaseBillDetails } from '../api/stock';
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
      const qtyParts = [];
      if (item.quantity_crates > 0) qtyParts.push(`${item.quantity_crates} cr`);
      if (item.quantity_kg > 0) qtyParts.push(`${item.quantity_kg} kg`);
      const qtyText = qtyParts.length > 0 ? qtyParts.join(' + ') : '0 kg';

      return `
      <tr>
        <td>
          <div>${item.fish_variety_name}</div>
          <div class="qty-subtext">${qtyText}</div>
        </td>
        <td class="text-center">${item.billable_weight}</td>
        <td class="text-center">${item.rate_per_kg}</td>
        <td class="text-right">${item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
      </tr>
      `;
    }).join('');

    const otherDeductionsHTML = bill.other_deductions.map((deduction) => `
      <div class="total-row charge-row">
        <span class="total-label charge-label">- ${deduction.type.charAt(0).toUpperCase() + deduction.type.slice(1)}:</span>
        <span class="total-value deduction-value">${deduction.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: 'Arial', sans-serif;
              padding: 0;
              margin: 0;
              font-size: 12px;
            }
            .header {
              background: #f8fafc;
              padding: 12px 16px;
              border-bottom: 2px solid #0ea5e9;
              margin-bottom: 16px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
              font-size: 10px;
            }
            .company-name {
              font-size: 26px;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: 2px;
              text-align: center;
              margin-bottom: 6px;
            }
            .proprietor {
              color: #475569;
              font-weight: 600;
            }
            .contact {
              color: #0ea5e9;
              font-weight: 700;
            }
            .tagline {
              font-size: 11px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              text-align: center;
              margin-bottom: 4px;
            }
            .address {
              font-size: 10px;
              color: #64748b;
              text-align: center;
            }
            .farmer-section {
              margin-bottom: 16px;
              padding-bottom: 12px;
              border-bottom: 1px solid #e5e7eb;
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
            }
            .farmer-name {
              font-size: 16px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 4px;
            }
            .farmer-details {
              font-size: 11px;
              color: #6b7280;
            }
            .bill-number {
              font-size: 14px;
              font-weight: bold;
              color: #111827;
              margin-bottom: 4px;
            }
            .bill-date {
              font-size: 11px;
              color: #6b7280;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            thead {
              background: #f3f4f6;
            }
            th {
              padding: 10px 8px;
              text-align: left;
              font-size: 11px;
              font-weight: bold;
              color: #374151;
            }
            td {
              padding: 10px 8px;
              font-size: 12px;
              color: #111827;
              border-bottom: 1px solid #f3f4f6;
            }
            .qty-subtext {
              font-size: 10px;
              color: #6b7280;
              margin-top: 2px;
            }
            .text-center {
              text-align: center;
            }
            .text-right {
              text-align: right;
            }
            .totals {
              margin-top: 16px;
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 12px;
            }
            .total-label {
              color: #6b7280;
            }
            .total-value {
              font-weight: 600;
              color: #111827;
            }
            .charge-row {
              padding-left: 20px;
            }
            .charge-label {
              font-weight: normal;
              font-size: 11px;
            }
            .charge-value {
              font-size: 11px;
              color: #059669;
            }
            .deduction-value {
              font-size: 11px;
              color: #DC2626;
            }
            .separator {
              height: 2px;
              background-color: #E5E7EB;
              margin: 16px 0;
            }
            .grand-total {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 2px solid #3b82f6;
            }
            .grand-total .total-label {
              font-size: 16px;
              font-weight: bold;
              color: #111827;
            }
            .grand-total .total-value {
              font-size: 18px;
              font-weight: bold;
              color: #3b82f6;
            }
            .payment-paid {
              color: #059669;
            }
            .payment-due {
              color: #DC2626;
            }
            .notes {
              margin-top: 16px;
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
            }
            .notes-title {
              font-size: 11px;
              font-weight: 600;
              color: #6b7280;
              margin-bottom: 6px;
            }
            .notes-text {
              font-size: 12px;
              color: #374151;
              font-style: italic;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #E5E7EB;
              text-align: center;
            }
            .footer-text {
              font-size: 16px;
              font-weight: 600;
              color: #10B981;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <span class="proprietor">Ibrahim Shaik (IB-NLR)</span>
              <span class="contact">📞 99087 04047</span>
            </div>
            <div class="company-name">S.K.S. Co.</div>
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
              <span class="total-label charge-label">+ Commission (₹${bill.commission_per_kg}/kg):</span>
              <span class="total-value charge-value">${bill.commission_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>

            ${otherDeductionsHTML}

            <div class="total-row grand-total">
              <span class="total-label">TOTAL DUE (₹):</span>
              <span class="total-value">${bill.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>

            ${bill.amount_paid > 0 ? `
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

          ${bill.notes ? `
          <div class="notes">
            <div class="notes-title">Notes:</div>
            <div class="notes-text">${bill.notes}</div>
          </div>
          ` : ''}

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
                Commission (₹{billDetails.commission_per_kg}/kg)
              </Text>
              <Text style={styles.summaryValueAdd}>
                +₹{billDetails.commission_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            {billDetails.other_deductions.map((deduction, index) => (
              <View key={index} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {deduction.type.charAt(0).toUpperCase() + deduction.type.slice(1)}
                </Text>
                <Text style={styles.summaryValueDeduction}>
                  -₹{deduction.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            ))}
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
                onPress={() => {
                  Alert.alert('Coming Soon', 'Add payment functionality will be implemented soon!');
                }}
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
                  <View>
                    <Text style={styles.paymentAmount}>
                      ₹{payment.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={styles.paymentMode}>
                      {payment.payment_mode.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.paymentDate}>
                    {new Date(payment.payment_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </Text>
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
});
