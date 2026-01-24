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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { Purchase } from '../types';
import { createPurchaseBill } from '../api/stock';

type RouteParams = {
  PurchaseBillGeneration: {
    farmer_id: number;
    farmer_name: string;
    farmer_location?: string;
    farmer_secondary_name?: string;
    purchases: Purchase[];
    date: string;
  };
};

export default function PurchaseBillGenerationScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PurchaseBillGeneration'>>();
  const { farmer_id, farmer_name, farmer_location, farmer_secondary_name, purchases, date } = route.params;

  const [items, setItems] = useState<Array<{
    purchaseId: number;
    varietyName: string;
    crates: number;
    kgPerCrate: number;
    looseKg: number;
    actualWeight: number;
    ratePerKg: string;
    applyDeduction: boolean;
    deductionWeight: number;
    billableWeight: number;
    grossAmount: number;
  }>>([]);

  const [commissionAmount, setCommissionAmount] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [otherChargesAddition, setOtherChargesAddition] = useState('');
  const [otherChargesDeduction, setOtherChargesDeduction] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Initialize items from purchases
    const initialItems = purchases.map(p => {
      const crates = p.quantity_crates || 0;
      const looseKg = p.quantity_kg || 0;
      const kgPerCrate = 35; // Default 35 kg per crate
      const calculatedWeight = crates * kgPerCrate;
      const actualWeight = calculatedWeight + looseKg;

      return {
        purchaseId: p.id,
        varietyName: p.fish_variety_name || 'Unknown',
        crates,
        kgPerCrate,
        looseKg,
        actualWeight,
        ratePerKg: '',
        applyDeduction: true, // Default: apply 5% deduction
        deductionWeight: Math.round(actualWeight * 0.05),
        billableWeight: actualWeight - Math.round(actualWeight * 0.05),
        grossAmount: 0,
      };
    });

    setItems(initialItems);
  }, [purchases]);

  const updateKgPerCrate = (index: number, kgPerCrate: string) => {
    const newItems = [...items];
    const kgPerCrateNum = parseFloat(kgPerCrate) || 0;
    newItems[index].kgPerCrate = kgPerCrateNum;

    // Recalculate actual weight based on crates × kg/crate + loose kg
    const looseKg = purchases[index]?.quantity_kg || 0;
    newItems[index].actualWeight = (newItems[index].crates * kgPerCrateNum) + looseKg;

    // Recalculate deduction and billable weight
    if (newItems[index].applyDeduction) {
      newItems[index].deductionWeight = Math.round(newItems[index].actualWeight * 0.05);
      newItems[index].billableWeight = newItems[index].actualWeight - Math.round(newItems[index].actualWeight * 0.05);
    } else {
      newItems[index].deductionWeight = 0;
      newItems[index].billableWeight = newItems[index].actualWeight;
    }

    // Recalculate gross amount
    const rateNum = parseFloat(newItems[index].ratePerKg) || 0;
    newItems[index].grossAmount = newItems[index].billableWeight * rateNum;

    setItems(newItems);
  };

  const updateItemRate = (index: number, rate: string) => {
    const newItems = [...items];
    newItems[index].ratePerKg = rate;
    const rateNum = parseFloat(rate) || 0;
    newItems[index].grossAmount = newItems[index].billableWeight * rateNum;
    setItems(newItems);
  };

  const toggleDeduction = (index: number) => {
    const newItems = [...items];
    newItems[index].applyDeduction = !newItems[index].applyDeduction;

    if (newItems[index].applyDeduction) {
      // Apply 5% deduction (rounded)
      newItems[index].deductionWeight = Math.round(newItems[index].actualWeight * 0.05);
      newItems[index].billableWeight = newItems[index].actualWeight - Math.round(newItems[index].actualWeight * 0.05);
    } else {
      // No deduction
      newItems[index].deductionWeight = 0;
      newItems[index].billableWeight = newItems[index].actualWeight;
    }

    // Recalculate gross amount
    const rateNum = parseFloat(newItems[index].ratePerKg) || 0;
    newItems[index].grossAmount = newItems[index].billableWeight * rateNum;

    setItems(newItems);
  };

  const calculateTotals = () => {
    const totalBillableWeight = items.reduce((sum, item) => sum + item.billableWeight, 0);
    const subtotal = items.reduce((sum, item) => sum + item.grossAmount, 0);
    const commission = parseFloat(commissionAmount) || 0;
    const advance = parseFloat(advanceAmount) || 0;
    const otherAddition = parseFloat(otherChargesAddition) || 0;
    const otherDeduction = parseFloat(otherChargesDeduction) || 0;
    const total = subtotal + commission + otherAddition - advance - otherDeduction;

    return {
      totalBillableWeight,
      subtotal,
      commission,
      advance,
      otherChargesAddition: otherAddition,
      otherChargesDeduction: otherDeduction,
      total,
    };
  };

  const handleGenerateBill = async () => {
    // Validation
    const hasEmptyRates = items.some(item => !item.ratePerKg || parseFloat(item.ratePerKg) === 0);
    if (hasEmptyRates) {
      Alert.alert('Error', 'Please enter rates for all items');
      return;
    }

    const totals = calculateTotals();

    Alert.alert(
      'Generate Bill',
      `Total Amount: ₹${totals.total.toLocaleString('en-IN')}\n\nBill will be created and you can add payments later from the bills list.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Generate',
          onPress: async () => {
            setSubmitting(true);

            try {
              // Prepare bill items
              const billItems = items.map((item, index) => ({
                purchase_id: item.purchaseId,
                fish_variety_id: purchases[index].fish_variety_id,
                fish_variety_name: item.varietyName,
                quantity_crates: item.crates,
                quantity_kg: purchases[index].quantity_kg || 0,
                actual_weight: item.actualWeight,
                billable_weight: item.billableWeight,
                rate_per_kg: parseFloat(item.ratePerKg),
                amount: item.grossAmount,
              }));

              // Create bill
              const result = await createPurchaseBill({
                farmer_id: farmer_id,
                bill_date: date,
                items: billItems,
                commission_amount: parseFloat(commissionAmount) || 0,
                advance_amount: parseFloat(advanceAmount) || 0,
                other_charges_addition: parseFloat(otherChargesAddition) || 0,
                other_charges_deduction: parseFloat(otherChargesDeduction) || 0,
                notes: notes,
                location: farmer_location,
                secondary_name: farmer_secondary_name,
              });

              setSubmitting(false);

              if (result.success) {
                Alert.alert(
                  'Success',
                  `Purchase bill created successfully!\n\nTotal: ₹${totals.total.toLocaleString('en-IN')}\n\nYou can now add payments from the bills list.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              } else {
                Alert.alert('Error', `Failed to create bill: ${result.error}`);
              }
            } catch (error) {
              setSubmitting(false);
              Alert.alert('Error', `An error occurred: ${String(error)}`);
            }
          },
        },
      ]
    );
  };

  const totals = calculateTotals();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Generate Purchase Bill</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Farmer Info */}
        <View style={styles.farmerInfoCard}>
          <Text style={styles.farmerName}>{farmer_name}</Text>
          {(farmer_location || farmer_secondary_name) && (
            <Text style={styles.farmerSubtitle}>
              {farmer_location && farmer_location}
              {farmer_location && farmer_secondary_name && ' • '}
              {farmer_secondary_name && farmer_secondary_name}
            </Text>
          )}
          <Text style={styles.billDate}>Bill Date: {date}</Text>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Purchase Items</Text>
          {items.map((item, index) => (
            <View key={item.purchaseId} style={styles.itemCard}>
              {/* Header with variety name and rate input */}
              <View style={styles.itemHeaderRow}>
                <View style={styles.itemHeaderLeft}>
                  <Text style={styles.varietyName}>{item.varietyName}</Text>
                  <Text style={styles.weightInfoText}>
                    {item.crates} cr × {item.kgPerCrate} kg{item.looseKg > 0 ? ` + ${item.looseKg.toFixed(0)} kg` : ''} = <Text style={styles.totalWeightBold}>{item.actualWeight.toFixed(0)} kg</Text>
                  </Text>
                </View>
                <View style={styles.rateInputCompact}>
                  <Text style={styles.rupeeSymbol}>₹</Text>
                  <TextInput
                    style={styles.rateInputSmall}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={item.ratePerKg}
                    onChangeText={(text) => updateItemRate(index, text)}
                  />
                </View>
              </View>

              {/* Deduction Toggle - Secondary action */}
              <TouchableOpacity
                style={styles.deductionToggle}
                onPress={() => toggleDeduction(index)}
              >
                <View style={[styles.checkbox, item.applyDeduction && styles.checkboxChecked]}>
                  {item.applyDeduction && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.deductionText}>
                  5% deduction ({item.applyDeduction ? `-${item.deductionWeight.toFixed(0)} kg` : 'skip'})
                </Text>
              </TouchableOpacity>

              {/* Amount Display - Clear result */}
              <View style={styles.amountDisplay}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Billable: {item.billableWeight.toFixed(0)} kg × ₹{item.ratePerKg || '0'}</Text>
                  <Text style={styles.amountValueBold}>₹{item.grossAmount.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Commission & Deductions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Charges & Deductions</Text>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Commission:</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={commissionAmount}
              onChangeText={setCommissionAmount}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Other charges (+):</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={otherChargesAddition}
              onChangeText={setOtherChargesAddition}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Advance:</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={advanceAmount}
              onChangeText={setAdvanceAmount}
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Other charges (-):</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={otherChargesDeduction}
              onChangeText={setOtherChargesDeduction}
            />
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Bill Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items Total</Text>
            <Text style={styles.summaryValue}>₹{totals.subtotal.toFixed(2)}</Text>
          </View>

          {(parseFloat(commissionAmount) || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>+ Commission</Text>
              <Text style={styles.summaryValue}>₹{totals.commission.toFixed(2)}</Text>
            </View>
          )}

          {(parseFloat(otherChargesAddition) || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>+ Other charges</Text>
              <Text style={styles.summaryValue}>₹{totals.otherChargesAddition.toFixed(2)}</Text>
            </View>
          )}

          {(parseFloat(advanceAmount) || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>- Advance</Text>
              <Text style={styles.summaryValue}>₹{totals.advance.toFixed(2)}</Text>
            </View>
          )}

          {(parseFloat(otherChargesDeduction) || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>- Other charges</Text>
              <Text style={styles.summaryValue}>₹{totals.otherChargesDeduction.toFixed(2)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{totals.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any notes about this bill..."
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Final Total */}
        <View style={styles.finalTotalCard}>
          <View style={styles.finalTotalRow}>
            <Text style={styles.finalTotalLabel}>Total Bill Amount</Text>
            <Text style={styles.finalTotalValue}>₹{totals.total.toLocaleString('en-IN')}</Text>
          </View>
          <Text style={styles.paymentNote}>Payments can be recorded after bill is generated</Text>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateBill}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.generateButtonText}>Generate Bill</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 50,
  },
  backButton: {
    fontSize: 16,
    color: '#0EA5E9',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  farmerInfoCard: {
    backgroundColor: '#FFF',
    padding: 16,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  farmerName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  farmerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  billDate: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  itemHeaderLeft: {
    flex: 1,
  },
  varietyName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  weightInfoText: {
    fontSize: 13,
    color: '#6B7280',
  },
  totalWeightBold: {
    fontWeight: '600',
    color: '#374151',
  },
  rateInputCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 100,
  },
  rupeeSymbol: {
    fontSize: 16,
    color: '#6B7280',
    marginRight: 4,
    fontWeight: '500',
  },
  rateInputSmall: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    padding: 0,
  },
  deductionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 3,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#E5E7EB',
    borderColor: '#9CA3AF',
  },
  checkmark: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deductionText: {
    fontSize: 13,
    color: '#6B7280',
  },
  amountDisplay: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginHorizontal: -12,
    marginBottom: -12,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  amountLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  amountValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  amountLabelBold: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  amountValueBold: {
    fontSize: 20,
    color: '#059669',
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  input: {
    width: 120,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFF',
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    padding: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  summaryValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#D1D5DB',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#059669',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#92400E',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  balancePositive: {
    color: '#B91C1C',
  },
  generateButton: {
    backgroundColor: '#0EA5E9',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    margin: 16,
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#FFF',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  finalTotalCard: {
    backgroundColor: '#FFF',
    padding: 20,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 8,
  },
  finalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  finalTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  paymentNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  helpText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentItemLeft: {
    flex: 1,
  },
  paymentItemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  paymentItemDetails: {
    fontSize: 12,
    color: '#6B7280',
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
    fontSize: 16,
    color: '#DC2626',
    fontWeight: 'bold',
  },
  addPaymentContainer: {
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addPaymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  paymentFormRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  paymentFormField: {
    flex: 1,
  },
  paymentFormLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  paymentFormInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFF',
  },
  paymentMethodPicker: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  miniPicker: {
    height: 44,
  },
  addPaymentBtnNew: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  addPaymentBtnText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  paymentsSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paymentsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentsSummaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentsSummaryValue: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
});
