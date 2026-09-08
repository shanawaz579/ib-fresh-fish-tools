import styles from '../styles/PurchaseBillGenerationScreen.styles';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createPurchaseBill, revisePurchaseBill } from '../api/stock';
import { getFishVarieties } from '../api/stock';
import { DEFAULT_CRATE_WEIGHT_KG, getPurchaseTotalWeightKg } from '../domain/fish';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { FishVariety } from '../types';
import SearchableSelectModal, { type SearchableOption } from '../components/SearchableSelectModal';

export default function PurchaseBillGenerationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PurchaseBillGeneration'>>();
  const { supplier_id, supplier_name, farmer_name, location, purchases, date, correction } = route.params;
  const isCorrection = Boolean(correction);
  const carriedPaymentTotal = correction?.bill.payments
    .filter(payment => !payment.voided_at)
    .reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0;
  const isDirectFarmer = purchases[0]?.supplier_type === 'farmer';
  const { configuration, formatMoney } = useBusinessConfig();
  const { preferences } = configuration;
  const deductionRate = preferences.purchase_weight_deduction_percent / 100;
  const currencySymbol = preferences.currency_symbol;

  const [items, setItems] = useState<Array<{
    purchaseId: number;
    fishVarietyId: number;
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
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [loadingVarieties, setLoadingVarieties] = useState(false);
  const [selectingItemIndex, setSelectingItemIndex] = useState<number | null>(null);

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
  const [initialPaymentAmount, setInitialPaymentAmount] = useState('');
  const [initialPaymentMode, setInitialPaymentMode] = useState<'cash' | 'upi' | 'bank_transfer'>('cash');
  const [initialPaymentReference, setInitialPaymentReference] = useState('');
  const [otherChargesAddition, setOtherChargesAddition] = useState('');
  const [otherChargesDeduction, setOtherChargesDeduction] = useState('');
  const [notes, setNotes] = useState('');
  const [correctionReason, setCorrectionReason] = useState(correction?.reason || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isCorrection) return;
    setLoadingVarieties(true);
    getFishVarieties()
      .then(setVarieties)
      .finally(() => setLoadingVarieties(false));
  }, [isCorrection]);

  const openItemSelector = async (index: number) => {
    if (loadingVarieties) return;
    if (varieties.length > 0) {
      setSelectingItemIndex(index);
      return;
    }

    setLoadingVarieties(true);
    const catalogItems = await getFishVarieties();
    setVarieties(catalogItems);
    setLoadingVarieties(false);
    if (catalogItems.length === 0) {
      Alert.alert('Items unavailable', 'No active catalog items could be loaded. Check the connection and try again.');
      return;
    }
    setSelectingItemIndex(index);
  };

  const itemOptions = useMemo<SearchableOption[]>(() => varieties.map(variant => ({
    id: variant.id,
    label: variant.name,
    group: variant.item_name,
    detail: variant.variant_code,
    searchText: [variant.item_name, variant.item_code, variant.grade_code, variant.grade_name].filter(Boolean).join(' '),
  })), [varieties]);

  useEffect(() => {
    // Initialize items from purchases
    const initialItems = purchases.map(p => {
      const original = correction?.bill.items.find(item => item.purchase_id === p.id);
      const crates = p.quantity_crates || 0;
      const looseKg = p.quantity_kg || 0;
      const originalKgPerCrate = original && crates > 0
        ? (Number(original.actual_weight) - looseKg) / crates
        : undefined;
      const kgPerCrate = originalKgPerCrate || p.default_kg_per_crate
        || preferences.default_crate_weight_kg
        || DEFAULT_CRATE_WEIGHT_KG;
      const actualWeight = original
        ? Number(original.actual_weight)
        : getPurchaseTotalWeightKg(crates, looseKg, kgPerCrate);
      const billableWeight = original ? Number(original.billable_weight) : actualWeight - Math.round(actualWeight * deductionRate);

      return {
        purchaseId: p.id,
        fishVarietyId: original?.fish_variety_id ?? p.fish_variety_id,
        varietyName: original?.fish_variety_name ?? p.fish_variety_name ?? 'Unknown',
        crates,
        kgPerCrate,
        looseKg,
        actualWeight,
        ratePerKg: original ? String(original.rate_per_kg) : '',
        applyDeduction: original ? billableWeight < actualWeight : deductionRate > 0,
        deductionWeight: actualWeight - billableWeight,
        billableWeight,
        grossAmount: original ? Number(original.amount) : 0,
      };
    });

    setItems(initialItems);
    if (correction) {
      const deductions = correction.bill.other_deductions || [];
      const deductionAmount = (type: string) => String(deductions.find(entry => entry.type === type)?.amount || '');
      setApplyCommission(Number(correction.bill.commission_per_kg) > 0);
      setCommissionPerKg(String(correction.bill.commission_per_kg || 0));
      setInitialPaymentAmount(deductionAmount('advance'));
      setOtherChargesAddition(deductionAmount('other_charges_addition'));
      setOtherChargesDeduction(deductionAmount('other_charges_deduction'));
      setNotes(correction.bill.notes || '');
      setCorrectionReason(correction.reason || '');
    }
  }, [correction, deductionRate, preferences.default_crate_weight_kg, purchases]);

  const updateKgPerCrate = (index: number, kgPerCrate: string) => {
    const newItems = [...items];
    const kgPerCrateNum = parseFloat(kgPerCrate) || 0;
    newItems[index].kgPerCrate = kgPerCrateNum;

    const looseKg = newItems[index].looseKg;
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

  const updateSourceQuantity = (index: number, field: 'crates' | 'looseKg', value: string) => {
    const next = [...items];
    const numericValue = field === 'crates'
      ? Math.max(0, Number.parseInt(value, 10) || 0)
      : Math.max(0, Number.parseFloat(value) || 0);
    next[index][field] = numericValue;
    next[index].actualWeight = getPurchaseTotalWeightKg(next[index].crates, next[index].looseKg, next[index].kgPerCrate);
    next[index].deductionWeight = next[index].applyDeduction
      ? Math.round(next[index].actualWeight * deductionRate)
      : 0;
    next[index].billableWeight = next[index].actualWeight - next[index].deductionWeight;
    next[index].grossAmount = next[index].billableWeight * (Number.parseFloat(next[index].ratePerKg) || 0);
    setItems(next);
  };

  const selectCorrectedVariant = (variantId: number) => {
    if (selectingItemIndex === null) return;
    const variant = varieties.find(row => row.id === Number(variantId));
    if (!variant) return;
    const next = [...items];
    const item = { ...next[selectingItemIndex] };
    item.fishVarietyId = variant.id;
    item.varietyName = variant.name;
    if (variant.default_kg_per_crate && variant.default_kg_per_crate > 0) {
      item.kgPerCrate = variant.default_kg_per_crate;
      item.actualWeight = getPurchaseTotalWeightKg(item.crates, item.looseKg, item.kgPerCrate);
      item.deductionWeight = item.applyDeduction ? Math.round(item.actualWeight * deductionRate) : 0;
      item.billableWeight = item.actualWeight - item.deductionWeight;
      item.grossAmount = item.billableWeight * (Number.parseFloat(item.ratePerKg) || 0);
    }
    next[selectingItemIndex] = item;
    setItems(next);
    setSelectingItemIndex(null);
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
    const payment = parseFloat(initialPaymentAmount) || 0;
    const otherAddition = parseFloat(otherChargesAddition) || 0;
    const otherDeduction = parseFloat(otherChargesDeduction) || 0;
    const total = subtotal + commission + otherAddition - otherDeduction;

    return {
      totalBillableWeight,
      subtotal,
      commissionRate,
      commission,
      payment,
      balanceDue: Math.max(total - carriedPaymentTotal - payment, 0),
      otherChargesAddition: otherAddition,
      otherChargesDeduction: otherDeduction,
      total,
    };
  };

  const handleGenerateBill = async () => {
    // Validation
    const hasEmptyRates = items.some(item => !item.ratePerKg || (parseFloat(item.ratePerKg) || 0) <= 0);
    if (hasEmptyRates) {
      Alert.alert('Error', 'Please enter rates for all items');
      return;
    }
    if (items.some(item => item.crates === 0 && item.looseKg === 0)) {
      Alert.alert('Quantity required', 'Every item needs crates, kilograms, or both.');
      return;
    }
    if (items.some(item => item.crates > 0 && item.kgPerCrate <= 0)) {
      Alert.alert('Weight required', 'Enter kilograms per crate for every item that has crates.');
      return;
    }
    if (applyCommission && (parseFloat(commissionPerKg) || 0) <= 0) {
      Alert.alert('Check commission', 'Enter a commission rate greater than zero or turn commission off.');
      return;
    }
    if (isCorrection && correctionReason.trim().length < 5) {
      Alert.alert('Correction reason required', 'Enter at least 5 characters explaining what was wrong.');
      return;
    }

    const totals = calculateTotals();
    if (carriedPaymentTotal + totals.payment > totals.total) {
      Alert.alert('Payment is too high', 'Retained and additional payments cannot exceed the corrected bill total.');
      return;
    }

    const submitBill = async () => {
      setSubmitting(true);

      try {
        const billItems = items.map((item) => ({
                purchase_id: item.purchaseId,
                fish_variety_id: item.fishVarietyId,
                fish_variety_name: item.varietyName,
                quantity_crates: item.crates,
                quantity_kg: item.looseKg,
                actual_weight: item.actualWeight,
                billable_weight: item.billableWeight,
                rate_per_kg: parseFloat(item.ratePerKg),
                amount: item.grossAmount,
        }));

        const billParams = {
                supplier_id,
                bill_date: date,
                items: billItems,
                commission_per_kg: totals.commissionRate,
                payment_amount: totals.payment,
                payment_mode: initialPaymentMode,
                payment_reference: initialPaymentReference,
                other_charges_addition: parseFloat(otherChargesAddition) || 0,
                other_charges_deduction: parseFloat(otherChargesDeduction) || 0,
                notes: notes,
                location,
        };
        const result = isCorrection && correction
          ? await revisePurchaseBill(correction.bill.id, correctionReason, billParams)
          : await createPurchaseBill(billParams);

        if (!result.success) throw new Error(result.error || 'The bill could not be saved');
        const successMessage = `${isCorrection ? 'Purchase bill updated successfully!' : 'Purchase bill created successfully!'}\n\nTotal: ${formatMoney(totals.total, 2)}`;
        if (Platform.OS === 'web') {
          window.alert(successMessage);
          navigation.goBack();
        } else {
          Alert.alert('Success', successMessage, [{ text: 'OK', onPress: () => navigation.goBack() }]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (Platform.OS === 'web') window.alert(`Unable to save bill\n\n${message}`);
        else Alert.alert('Unable to save bill', message);
      } finally {
        setSubmitting(false);
      }
    };

    const confirmationMessage = `Total Amount: ${formatMoney(totals.total, 2)}\n\n${isCorrection ? `This will replace ${correction?.bill.bill_number} and preserve the original in correction history.` : 'Bill will be created and you can add payments later from the bills list.'}`;
    if (Platform.OS === 'web') {
      if (window.confirm(`${isCorrection ? 'Save bill changes?' : 'Generate Bill'}\n\n${confirmationMessage}`)) void submitBill();
      return;
    }
    Alert.alert(isCorrection ? 'Save bill changes?' : 'Generate Bill', confirmationMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: isCorrection ? 'Save changes' : 'Generate', onPress: () => void submitBill() },
    ]);
  };

  const totals = calculateTotals();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isCorrection ? 'Edit Purchase Bill' : 'Generate Purchase Bill'}</Text>
      </View>

      <ScrollView style={styles.content}>
        {isCorrection ? (
          <View style={styles.correctionCard}>
            <Text style={styles.correctionTitle}>EDITING {correction?.bill.bill_number}</Text>
            <Text style={styles.correctionText}>All original items, quantities, rates and charges are prefilled below.</Text>
          </View>
        ) : null}
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
              {isCorrection ? (
                <>
                  <Text style={styles.correctionFieldLabel}>ITEM & GRADE</Text>
                  <TouchableOpacity style={styles.correctionSelect} disabled={loadingVarieties} onPress={() => void openItemSelector(index)}>
                    <Text style={styles.correctionSelectValue}>{item.varietyName}</Text>
                    <Text style={styles.correctionSelectAction}>{loadingVarieties ? 'Loading…' : 'Change ›'}</Text>
                  </TouchableOpacity>
                  <View style={styles.correctionQuantityRow}>
                    <View style={styles.correctionQuantityField}>
                      <Text style={styles.correctionFieldLabel}>CRATES</Text>
                      <TextInput style={styles.correctionQuantityInput} keyboardType="number-pad" value={String(item.crates || '')} onChangeText={value => updateSourceQuantity(index, 'crates', value)} placeholder="0" />
                    </View>
                    <View style={styles.correctionQuantityField}>
                      <Text style={styles.correctionFieldLabel}>LOOSE KG</Text>
                      <TextInput style={styles.correctionQuantityInput} keyboardType="decimal-pad" value={String(item.looseKg || '')} onChangeText={value => updateSourceQuantity(index, 'looseKg', value)} placeholder="0" />
                    </View>
                  </View>
                </>
              ) : null}
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
            <Text style={styles.inputLabel}>{carriedPaymentTotal > 0 ? 'Additional payment now:' : 'Payment now:'}</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={initialPaymentAmount}
              onChangeText={setInitialPaymentAmount}
            />
          </View>
          <Text style={styles.paymentNote}>
            {carriedPaymentTotal > 0
              ? `${formatMoney(carriedPaymentTotal, 2)} already paid will be retained automatically. Add only a new payment here.`
              : 'This creates a real supplier payment and reduces the balance due. It does not reduce the bill value.'}
          </Text>
          {(parseFloat(initialPaymentAmount) || 0) > 0 ? (
            <>
              <View style={styles.paymentMethodRow}>
                {([
                  ['cash', 'Cash'],
                  ['upi', 'UPI'],
                  ['bank_transfer', 'Bank'],
                ] as const).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.paymentMethodChip, initialPaymentMode === value && styles.paymentMethodChipActive]}
                    onPress={() => setInitialPaymentMode(value)}
                  >
                    <Text style={[styles.paymentMethodText, initialPaymentMode === value && styles.paymentMethodTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.paymentReferenceInput}
                placeholder="Reference number (optional)"
                value={initialPaymentReference}
                onChangeText={setInitialPaymentReference}
                autoCapitalize="characters"
              />
            </>
          ) : null}

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

          {totals.payment > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment now ({initialPaymentMode === 'bank_transfer' ? 'Bank' : initialPaymentMode.toUpperCase()})</Text>
              <Text style={styles.summaryValue}>-{formatMoney(totals.payment, 2)}</Text>
            </View>
          )}
          {carriedPaymentTotal > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment already recorded</Text>
              <Text style={styles.summaryValue}>-{formatMoney(carriedPaymentTotal, 2)}</Text>
            </View>
          ) : null}

          {(parseFloat(otherChargesDeduction) || 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>- Other charges</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.otherChargesDeduction, 2)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Bill Amount</Text>
            <Text style={styles.totalValue}>{formatMoney(totals.total, 2)}</Text>
          </View>
          {carriedPaymentTotal + totals.payment > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Balance Due</Text>
              <Text style={styles.totalValue}>{formatMoney(totals.balanceDue, 2)}</Text>
            </View>
          ) : null}
        </View>

        {/* Notes Section */}
        {isCorrection ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason for change *</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Example: incorrect rate entered"
              multiline
              numberOfLines={2}
              value={correctionReason}
              onChangeText={setCorrectionReason}
            />
          </View>
        ) : null}

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
          <Text style={styles.paymentNote}>{carriedPaymentTotal + totals.payment > 0 ? `Total paid: ${formatMoney(carriedPaymentTotal + totals.payment, 2)} · Balance due: ${formatMoney(totals.balanceDue, 2)}` : 'Payments can also be recorded after the bill is generated'}</Text>
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
            <Text style={styles.generateButtonText}>{isCorrection ? 'Save Bill Changes' : 'Generate Bill'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
      <SearchableSelectModal
        visible={selectingItemIndex !== null}
        title="Correct item and grade"
        searchPlaceholder="Search item, code or grade"
        options={itemOptions}
        emptyMessage="No active catalog item found"
        onSelect={selectCorrectedVariant}
        onClose={() => setSelectingItemIndex(null)}
      />
    </View>
  );
}
