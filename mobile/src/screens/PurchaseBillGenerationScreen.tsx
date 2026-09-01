import styles from '../styles/PurchaseBillGenerationScreen.styles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
import { DEFAULT_CRATE_WEIGHT_KG, getPurchaseTotalWeightKg } from '../domain/fish';
import { useBusinessConfig } from '../context/BusinessConfigContext';

type RouteParams = {
  PurchaseBillGeneration: {
    supplier_id: number;
    supplier_name: string;
    farmer_name?: string;
    location?: string;
    purchases: Purchase[];
    date: string;
  };
};

export default function PurchaseBillGenerationScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PurchaseBillGeneration'>>();
  const { supplier_id, supplier_name, farmer_name, location, purchases, date } = route.params;
  const isDirectFarmer = purchases[0]?.supplier_type === 'farmer';
  const { configuration, formatMoney } = useBusinessConfig();
  const { preferences } = configuration;
  const deductionRate = preferences.purchase_weight_deduction_percent / 100;
  const currencySymbol = preferences.currency_symbol;

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

  const [applyCommission, setApplyCommission] = useState(
    isDirectFarmer
      ? preferences.apply_direct_commission_by_default
      : preferences.apply_mediator_commission_by_default,
  );
  const [commissionPerKg, setCommissionPerKg] = useState(String(
    isDirectFarmer
      ? preferences.direct_commission_per_kg
      : preferences.mediator_commission_per_kg,
  ));
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
      const kgPerCrate = p.default_kg_per_crate
        || preferences.default_crate_weight_kg
        || DEFAULT_CRATE_WEIGHT_KG;
      const actualWeight = getPurchaseTotalWeightKg(crates, looseKg, kgPerCrate);

      return {
        purchaseId: p.id,
        varietyName: p.fish_variety_name || 'Unknown',
        crates,
        kgPerCrate,
        looseKg,
        actualWeight,
        ratePerKg: '',
        applyDeduction: deductionRate > 0,
        deductionWeight: Math.round(actualWeight * deductionRate),
        billableWeight: actualWeight - Math.round(actualWeight * deductionRate),
        grossAmount: 0,
      };
    });

    setItems(initialItems);
  }, [deductionRate, preferences.default_crate_weight_kg, purchases]);

  const updateKgPerCrate = (index: number, kgPerCrate: string) => {
    const newItems = [...items];
    const kgPerCrateNum = parseFloat(kgPerCrate) || 0;
    newItems[index].kgPerCrate = kgPerCrateNum;

    const looseKg = purchases[index]?.quantity_kg || 0;
    newItems[index].actualWeight = getPurchaseTotalWeightKg(
      newItems[index].crates,
      looseKg,
      kgPerCrateNum,
    );

    // Recalculate deduction and billable weight
    if (newItems[index].applyDeduction) {
      newItems[index].deductionWeight = Math.round(newItems[index].actualWeight * deductionRate);
      newItems[index].billableWeight = newItems[index].actualWeight - Math.round(newItems[index].actualWeight * deductionRate);
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
      newItems[index].deductionWeight = Math.round(newItems[index].actualWeight * deductionRate);
      newItems[index].billableWeight = newItems[index].actualWeight - Math.round(newItems[index].actualWeight * deductionRate);
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
    const commissionRate = applyCommission
      ? (parseFloat(commissionPerKg) || 0)
      : 0;
    const commission = Number((totalBillableWeight * commissionRate).toFixed(2));
    const advance = parseFloat(advanceAmount) || 0;
    const otherAddition = parseFloat(otherChargesAddition) || 0;
    const otherDeduction = parseFloat(otherChargesDeduction) || 0;
    const total = subtotal + commission + otherAddition - advance - otherDeduction;

    return {
      totalBillableWeight,
      subtotal,
      commissionRate,
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
    if (applyCommission && (parseFloat(commissionPerKg) || 0) <= 0) {
      Alert.alert('Check commission', 'Enter a commission rate greater than zero or turn commission off.');
      return;
    }

    const totals = calculateTotals();

    Alert.alert(
      'Generate Bill',
      `Total Amount: ${formatMoney(totals.total, 2)}\n\nBill will be created and you can add payments later from the bills list.`,
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
                supplier_id,
                bill_date: date,
                items: billItems,
                commission_per_kg: totals.commissionRate,
                advance_amount: parseFloat(advanceAmount) || 0,
                other_charges_addition: parseFloat(otherChargesAddition) || 0,
                other_charges_deduction: parseFloat(otherChargesDeduction) || 0,
                notes: notes,
                location,
              });

              setSubmitting(false);

              if (result.success) {
                Alert.alert(
                  'Success',
                  `Purchase bill created successfully!\n\nTotal: ${formatMoney(totals.total, 2)}\n\nYou can now add payments from the bills list.`,
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
        {/* Primary supplier and source farmer */}
        <View style={styles.farmerInfoCard}>
          <Text style={styles.farmerName}>{supplier_name}</Text>
          {(farmer_name || location) && (
            <Text style={styles.farmerSubtitle}>
              {farmer_name ? (isDirectFarmer ? 'Direct harvest' : `Source farmer: ${farmer_name}`) : ''}
              {farmer_name && location ? ' • ' : ''}
              {location || ''}
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
                    {[
                      item.crates > 0 ? `${item.crates} cr × ${item.kgPerCrate} kg` : '',
                      item.looseKg > 0 ? `${item.looseKg} kg` : '',
                    ].filter(Boolean).join(' + ')} = <Text style={styles.totalWeightBold}>{item.actualWeight.toFixed(0)} kg</Text>
                  </Text>
                </View>
                <View style={styles.rateInputCompact}>
                  <Text style={styles.rupeeSymbol}>{currencySymbol}</Text>
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
                  {preferences.purchase_weight_deduction_percent}% deduction ({item.applyDeduction ? `-${item.deductionWeight.toFixed(0)} kg` : 'skip'})
                </Text>
              </TouchableOpacity>

              {/* Amount Display - Clear result */}
              <View style={styles.amountDisplay}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Billable: {item.billableWeight.toFixed(0)} kg × {currencySymbol}{item.ratePerKg || '0'}</Text>
                  <Text style={styles.amountValueBold}>{formatMoney(item.grossAmount, 2)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Commission & Deductions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Charges & Deductions</Text>

          <View style={styles.commissionCard}>
            <TouchableOpacity
              style={styles.commissionToggle}
              onPress={() => setApplyCommission((current) => !current)}
            >
              <View style={[styles.checkbox, applyCommission && styles.checkboxChecked]}>
                {applyCommission ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <View style={styles.commissionIdentity}>
                <Text style={styles.commissionTitle}>Apply commission</Text>
                <Text style={styles.commissionSubtitle}>Calculated on total billable weight</Text>
              </View>
            </TouchableOpacity>
            {applyCommission ? (
              <View style={styles.commissionRateRow}>
                <Text style={styles.commissionFormula}>{totals.totalBillableWeight.toFixed(0)} kg × {currencySymbol}</Text>
                <TextInput
                  style={styles.commissionRateInput}
                  keyboardType="decimal-pad"
                  value={commissionPerKg}
                  onChangeText={setCommissionPerKg}
                  selectTextOnFocus
                />
                <Text style={styles.commissionFormula}>/kg = {formatMoney(totals.commission, 2)}</Text>
              </View>
            ) : null}
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
            <Text style={styles.inputLabel}>Advance paid:</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={advanceAmount}
              onChangeText={setAdvanceAmount}
            />
          </View>
          <Text style={styles.paymentNote}>
            Advance is a bill adjustment that reduces the payable total. New payments are recorded separately after creating the bill.
          </Text>

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
            <Text style={styles.summaryValue}>{formatMoney(totals.subtotal, 2)}</Text>
          </View>

          {totals.commission > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>+ Commission ({totals.commissionRate.toFixed(2)}/kg)</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.commission, 2)}</Text>
            </View>
          )}

          {(parseFloat(otherChargesAddition) || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>+ Other charges</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.otherChargesAddition, 2)}</Text>
            </View>
          )}

          {(parseFloat(advanceAmount) || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>- Advance</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.advance, 2)}</Text>
            </View>
          )}

          {(parseFloat(otherChargesDeduction) || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>- Other charges</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.otherChargesDeduction, 2)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatMoney(totals.total, 2)}</Text>
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
            <Text style={styles.finalTotalValue}>{formatMoney(totals.total, 2)}</Text>
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
