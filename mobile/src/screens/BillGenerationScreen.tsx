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
} from '../api/stock';
import type { Customer, Sale, FishVariety, Bill, BillItem } from '../types';

type BillItemForm = {
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  crate_weight: number; // kg per crate
  total_weight: number; // calculated total weight in kg
  rate_per_kg: number;
};

export default function BillGenerationScreen() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [billItems, setBillItems] = useState<BillItemForm[]>([]);
  const [adjustments, setAdjustments] = useState<Array<{ label: string; amount: number }>>([]);
  const [newAdjustmentLabel, setNewAdjustmentLabel] = useState('');
  const [newAdjustmentAmount, setNewAdjustmentAmount] = useState('');
  const [previousBalance, setPreviousBalance] = useState('0');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bill preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);

  useEffect(() => {
    loadData();
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
    // Get sales for this customer on this date
    const customerSales = sales.filter(s => s.customer_id === customerId);

    if (customerSales.length === 0) {
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
  };

  const handleCustomerSelect = (customerId: number | null) => {
    if (!customerId) {
      setSelectedCustomerId(null);
      setBillItems([]);
      return;
    }

    setSelectedCustomerId(customerId);
    loadCustomerSales(customerId);
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
    const subtotal = billItems.reduce((sum, item) => sum + calculateItemAmount(item), 0);
    const adjustmentsTotal = adjustments.reduce((sum, adj) => sum + adj.amount, 0);
    const prevBalance = parseFloat(previousBalance) || 0;
    const total = subtotal + adjustmentsTotal + prevBalance;
    return { subtotal, adjustmentsTotal, prevBalance, total };
  };

  const handleAddAdjustment = () => {
    if (!newAdjustmentLabel.trim() || !newAdjustmentAmount) {
      Alert.alert('Error', 'Please enter both label and amount');
      return;
    }
    setAdjustments([...adjustments, { label: newAdjustmentLabel.trim(), amount: parseFloat(newAdjustmentAmount) || 0 }]);
    setNewAdjustmentLabel('');
    setNewAdjustmentAmount('');
  };

  const handleRemoveAdjustment = (index: number) => {
    setAdjustments(adjustments.filter((_, i) => i !== index));
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

    setSubmitting(true);
    try {
      // Convert to BillItem format for the API
      const billItemsForAPI = billItems.map(item => ({
        fish_variety_id: item.fish_variety_id,
        fish_variety_name: item.fish_variety_name,
        quantity_crates: item.quantity_crates,
        quantity_kg: item.quantity_kg,
        rate_per_crate: 0, // Not used, all calculation is in kg
        rate_per_kg: item.rate_per_kg,
      }));

      // Calculate total adjustments (negative discount becomes negative adjustment)
      const totalAdjustments = adjustments.reduce((sum, adj) => sum + adj.amount, 0);

      const bill = await createBill(
        selectedCustomerId,
        date,
        billItemsForAPI,
        -totalAdjustments, // Convert adjustments to discount format for API
        notes
      );

      if (bill) {
        Alert.alert('Success', `Bill ${bill.bill_number} generated successfully!`);

        // Reset form
        setSelectedCustomerId(null);
        setBillItems([]);
        setAdjustments([]);
        setPreviousBalance('0');
        setNotes('');

        // Reload bills
        await loadData();
      } else {
        Alert.alert('Error', 'Failed to generate bill');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to generate bill');
    }
    setSubmitting(false);
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
    const formItems: BillItemForm[] = bill.items.map(item => {
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
*S.K.S. Co. - INVOICE*
Wholesale Fish & Prawn Trading
Proprietor: Ibrahim | 📞 99087 04047
Muttukur Road, Nellore

━━━━━━━━━━━━━━━━━━━━━━
Bill No: ${previewBill.bill_number}
Date: ${new Date(previewBill.bill_date).toLocaleDateString('en-IN')}
Customer: ${customer?.name || 'Unknown'}

*Items:*
${previewBill.items.map(item => {
  const crateWeight = 35; // kg per crate
  const totalWeight = (item.quantity_crates * crateWeight) + item.quantity_kg;
  return `${item.fish_variety_name}
  Qty: ${item.quantity_crates > 0 ? `${item.quantity_crates} crates` : ''}${item.quantity_crates > 0 && item.quantity_kg > 0 ? ' + ' : ''}${item.quantity_kg > 0 ? `${item.quantity_kg} kg` : ''}
  Total Weight: ${totalWeight.toFixed(2)} kg
  Rate: ₹${item.rate_per_kg}/kg
  Amount: ₹${item.amount.toFixed(2)}`;
}).join('\n\n')}

*Subtotal:* ₹${previewBill.subtotal.toFixed(2)}
*Discount:* ₹${previewBill.discount.toFixed(2)}
*Total:* ₹${previewBill.total.toFixed(2)}

${previewBill.notes ? `Notes: ${previewBill.notes}` : ''}

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

    // Generate HTML for PDF
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Arial', sans-serif;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          background: #f8fafc;
          padding: 20px;
          border-bottom: 3px solid #0ea5e9;
          margin-bottom: 20px;
        }
        .company-name {
          font-size: 28px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 2px;
          margin-bottom: 5px;
        }
        .tagline {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        .divider {
          height: 1px;
          background: #e2e8f0;
          margin: 10px 0;
        }
        .contact-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 5px;
        }
        .proprietor {
          color: #475569;
          font-weight: 600;
        }
        .contact {
          color: #0ea5e9;
          font-weight: 700;
        }
        .address {
          font-size: 10px;
          color: #64748b;
          text-align: center;
        }
        .bill-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .bill-info-item {
          flex: 1;
        }
        .label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .value {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }
        .customer-section {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e5e7eb;
        }
        .customer-name {
          font-size: 18px;
          font-weight: bold;
          color: #111827;
          margin-bottom: 5px;
        }
        .total-boxes {
          font-size: 11px;
          color: #6b7280;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        thead {
          background: #f3f4f6;
        }
        th {
          padding: 10px;
          text-align: left;
          font-size: 11px;
          font-weight: bold;
          color: #374151;
        }
        td {
          padding: 12px 10px;
          font-size: 13px;
          color: #111827;
          border-bottom: 1px solid #f3f4f6;
        }
        .qty-subtext {
          font-size: 10px;
          color: #6b7280;
        }
        .text-center {
          text-align: center;
        }
        .text-right {
          text-align: right;
        }
        .totals {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 2px solid #e5e7eb;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .total-label {
          color: #6b7280;
        }
        .total-value {
          font-weight: 600;
          color: #111827;
        }
        .grand-total {
          margin-top: 10px;
          padding-top: 12px;
          border-top: 2px solid #3b82f6;
        }
        .grand-total .total-label {
          font-size: 18px;
          font-weight: bold;
          color: #111827;
        }
        .grand-total .total-value {
          font-size: 20px;
          font-weight: bold;
          color: #3b82f6;
        }
        .notes {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
        }
        .notes-title {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .notes-text {
          font-size: 14px;
          color: #374151;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">S.K.S. Co.</div>
        <div class="tagline">Wholesale Fish & Prawn Trading</div>
        <div class="divider"></div>
        <div class="contact-row">
          <span class="proprietor">Proprietor: Ibrahim</span>
          <span class="contact">📞 99087 04047</span>
        </div>
        <div class="address">Muttukur Road, Nellore</div>
      </div>

      <div class="bill-info">
        <div class="bill-info-item">
          <div class="label">Bill No:</div>
          <div class="value">${previewBill.bill_number}</div>
        </div>
        <div class="bill-info-item" style="text-align: right;">
          <div class="label">Date:</div>
          <div class="value">${new Date(previewBill.bill_date).toLocaleDateString('en-IN')}</div>
        </div>
      </div>

      <div class="customer-section">
        <div class="label">Customer:</div>
        <div class="customer-name">${customer?.name || 'Unknown'}</div>
        <div class="total-boxes">Total: ${previewBill.items.reduce((sum, item) => sum + item.quantity_crates, 0)} boxes</div>
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
          ${previewBill.items.map(item => {
            const crateWeight = 35;
            const totalWeight = (item.quantity_crates * crateWeight) + item.quantity_kg;
            const qtyText = [
              item.quantity_crates > 0 && `${item.quantity_crates} cr`,
              item.quantity_kg > 0 && `${item.quantity_kg} kg`
            ].filter(Boolean).join(' + ');
            return `
            <tr>
              <td>
                <div>${item.fish_variety_name}</div>
                <div class="qty-subtext">${qtyText}</div>
              </td>
              <td class="text-center">${totalWeight.toFixed(2)}</td>
              <td class="text-center">${item.rate_per_kg}</td>
              <td class="text-right">${item.amount.toFixed(2)}</td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span class="total-label">Subtotal (₹):</span>
          <span class="total-value">${previewBill.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span class="total-label">Discount (₹):</span>
          <span class="total-value">${previewBill.discount.toFixed(2)}</span>
        </div>
        <div class="total-row grand-total">
          <span class="total-label">Total (₹):</span>
          <span class="total-value">${previewBill.total.toFixed(2)}</span>
        </div>
      </div>

      ${previewBill.notes ? `
      <div class="notes">
        <div class="notes-title">Notes:</div>
        <div class="notes-text">${previewBill.notes}</div>
      </div>
      ` : ''}
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

  const { subtotal, adjustmentsTotal, prevBalance, total } = calculateTotals();
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

          {/* Bill Items */}
          {selectedCustomerId && billItems.length > 0 && (
            <>
              <Text style={styles.subSectionTitle}>Bill Items</Text>
              {billItems.map((item, index) => {
                const qtyDisplay = `${item.quantity_crates} cr${item.quantity_kg > 0 ? ` + ${Math.round(item.quantity_kg)} kg` : ''}`;
                const weightDisplay = `${Math.round(item.total_weight)} kg`;

                return (
                  <View key={index} style={styles.billItemCardCompact}>
                    {/* Single Row Layout */}
                    <View style={styles.singleRow}>
                      {/* Left: Name */}
                      <View style={styles.nameSection}>
                        <Text style={styles.itemNameCompact}>{item.fish_variety_name}</Text>
                        <Text style={styles.itemQtyCompact}>{qtyDisplay}</Text>
                      </View>

                      {/* Right: Inputs and Values */}
                      <View style={styles.valuesSection}>
                        {/* Row 1: Crate Wt and Total Wt */}
                        <View style={styles.weightInputRow}>
                          <TextInput
                            style={styles.miniInput}
                            placeholder="35"
                            keyboardType="numeric"
                            value={item.crate_weight.toString()}
                            onChangeText={(value) => updateItemField(index, 'crate_weight', value)}
                          />
                          <Text style={styles.miniLabel}>kg/cr</Text>
                          <Text style={styles.miniArrow}>→</Text>
                          <Text style={styles.miniWeight}>{weightDisplay}</Text>
                        </View>

                        {/* Row 2: Rate and Amount */}
                        <View style={styles.rateAmountRow}>
                          <TextInput
                            style={styles.miniInput}
                            placeholder="0"
                            keyboardType="numeric"
                            value={item.rate_per_kg.toString()}
                            onChangeText={(value) => updateItemField(index, 'rate_per_kg', value)}
                          />
                          <Text style={styles.miniLabel}>₹/kg</Text>
                          <Text style={styles.miniArrow}>→</Text>
                          <Text style={styles.miniAmount}>₹{calculateItemAmount(item).toLocaleString('en-IN')}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Previous Balance */}
              <View style={styles.balanceContainer}>
                <Text style={styles.label}>Previous Balance</Text>
                <View style={styles.balanceInputWrapper}>
                  <Text style={styles.rupeeSymbol}>₹</Text>
                  <TextInput
                    style={styles.balanceInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={previousBalance}
                    onChangeText={setPreviousBalance}
                  />
                </View>
              </View>

              {/* Adjustments */}
              <View style={styles.adjustmentsContainer}>
                <Text style={styles.label}>Adjustments (+ / -)</Text>

                {adjustments.map((adj, index) => (
                  <View key={index} style={styles.adjustmentItem}>
                    <Text style={styles.adjustmentLabel}>{adj.label}</Text>
                    <Text style={[styles.adjustmentAmount, adj.amount < 0 && styles.negativeAmount]}>
                      {adj.amount > 0 ? '+' : ''}₹{adj.amount.toLocaleString('en-IN')}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveAdjustment(index)} style={styles.removeAdjBtn}>
                      <Text style={styles.removeAdjText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addAdjustmentRow}>
                  <TextInput
                    style={[styles.input, styles.adjLabelInput]}
                    placeholder="Label (e.g., Discount, Transport)"
                    value={newAdjustmentLabel}
                    onChangeText={setNewAdjustmentLabel}
                  />
                  <TextInput
                    style={[styles.input, styles.adjAmountInput]}
                    placeholder="+/- Amount"
                    keyboardType="numeric"
                    value={newAdjustmentAmount}
                    onChangeText={setNewAdjustmentAmount}
                  />
                  <TouchableOpacity onPress={handleAddAdjustment} style={styles.addAdjBtn}>
                    <Text style={styles.addAdjText}>+</Text>
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
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal:</Text>
                  <Text style={styles.totalValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
                </View>
                {prevBalance > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Previous Balance:</Text>
                    <Text style={styles.totalValue}>₹{Math.round(prevBalance).toLocaleString('en-IN')}</Text>
                  </View>
                )}
                {adjustments.map((adj, index) => (
                  <View key={index} style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{adj.label}:</Text>
                    <Text style={[styles.totalValue, adj.amount < 0 && styles.negativeValue]}>
                      {adj.amount > 0 ? '+' : ''}₹{Math.round(adj.amount).toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
                <View style={[styles.totalRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Total:</Text>
                  <Text style={styles.grandTotalValue}>₹{total.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              {/* Generate Button */}
              <TouchableOpacity
                onPress={handleGenerateBill}
                disabled={submitting}
                style={[styles.generateButton, submitting && styles.buttonDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.generateButtonText}>Generate Bill</Text>
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
              return (
                <View key={bill.id} style={styles.billCard}>
                  <View style={styles.billHeader}>
                    <View>
                      <Text style={styles.billNumber}>{bill.bill_number}</Text>
                      <Text style={styles.billCustomer}>{customer?.name || 'Unknown'}</Text>
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
                  <Text style={styles.companyNameMain}>S.K.S. Co.</Text>
                  <Text style={styles.businessTagline}>Wholesale Fish & Prawn Trading</Text>
                  <View style={styles.headerDivider} />
                  <View style={styles.contactRow}>
                    <Text style={styles.proprietorText}>Proprietor: Ibrahim</Text>
                    <Text style={styles.contactText}>📞 99087 04047</Text>
                  </View>
                  <Text style={styles.addressText}>Muttukur Road, Nellore</Text>
                </View>

                <View style={styles.billInfoRow}>
                  <View>
                    <Text style={styles.billInfoLabel}>Bill No:</Text>
                    <Text style={styles.billInfoValue}>{previewBill.bill_number}</Text>
                  </View>
                  <View>
                    <Text style={styles.billInfoLabel}>Date:</Text>
                    <Text style={styles.billInfoValue}>
                      {new Date(previewBill.bill_date).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                </View>

                <View style={styles.customerInfo}>
                  <Text style={styles.billInfoLabel}>Customer:</Text>
                  <Text style={styles.customerNameBig}>
                    {customers.find(c => c.id === previewBill.customer_id)?.name || 'Unknown'}
                  </Text>
                  <Text style={styles.totalBoxesText}>
                    Total: {previewBill.items.reduce((sum, item) => sum + item.quantity_crates, 0)} boxes
                  </Text>
                </View>

                <View style={styles.itemsTable}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.itemColumnWide]}>Item</Text>
                    <Text style={[styles.tableHeaderText, styles.weightColumn]}>Weight{'\n'}(kg)</Text>
                    <Text style={[styles.tableHeaderText, styles.rateColumn]}>Rate{'\n'}(₹/kg)</Text>
                    <Text style={[styles.tableHeaderText, styles.amountColumn]}>Amount{'\n'}(₹)</Text>
                  </View>
                  {previewBill.items.map((item, index) => {
                    const crateWeight = 35; // kg per crate
                    const totalWeight = (item.quantity_crates * crateWeight) + item.quantity_kg;
                    const qtyText = [
                      item.quantity_crates > 0 && `${item.quantity_crates} cr`,
                      item.quantity_kg > 0 && `${item.quantity_kg} kg`
                    ].filter(Boolean).join(' + ');

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
                  <View style={styles.billTotalRow}>
                    <Text style={styles.billTotalLabel}>Subtotal (₹):</Text>
                    <Text style={styles.billTotalValue}>{previewBill.subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.billTotalRow}>
                    <Text style={styles.billTotalLabel}>Discount (₹):</Text>
                    <Text style={styles.billTotalValue}>{previewBill.discount.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.billTotalRow, styles.grandTotal]}>
                    <Text style={styles.billGrandTotalLabel}>Total (₹):</Text>
                    <Text style={styles.billGrandTotalValue}>{previewBill.total.toFixed(2)}</Text>
                  </View>
                </View>

                {previewBill.notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesTitle}>Notes:</Text>
                    <Text style={styles.notesText}>{previewBill.notes}</Text>
                  </View>
                )}
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
  // Ultra Compact Single Row Bill Item
  billItemCardCompact: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  singleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameSection: {
    flex: 1,
  },
  itemNameCompact: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  itemQtyCompact: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  valuesSection: {
    gap: 4,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rateAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    minWidth: 35,
    textAlign: 'center',
  },
  miniLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  miniArrow: {
    fontSize: 11,
    color: '#D1D5DB',
    marginHorizontal: 2,
  },
  miniWeight: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  miniRupee: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  miniAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#10B981',
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
  adjustmentsContainer: {
    marginTop: 16,
  },
  adjustmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adjustmentLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  adjustmentAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
    marginRight: 8,
  },
  negativeAmount: {
    color: '#DC2626',
  },
  negativeValue: {
    color: '#DC2626',
  },
  removeAdjBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAdjText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addAdjustmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  adjLabelInput: {
    flex: 2,
  },
  adjAmountInput: {
    flex: 1,
  },
  addAdjBtn: {
    width: 44,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAdjText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
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
    padding: 18,
    borderRadius: 0,
    marginBottom: 16,
    borderBottomWidth: 3,
    borderBottomColor: '#0EA5E9',
  },
  companyNameMain: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 2,
  },
  businessTagline: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  proprietorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  contactText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  addressText: {
    fontSize: 10,
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
  billInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  billInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  billInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  customerInfo: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  customerNameBig: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  totalBoxesText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
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
});
