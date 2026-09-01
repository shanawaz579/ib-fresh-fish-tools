import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SearchableSelectModal, { type SearchableOption } from '../../components/SearchableSelectModal';
import { reconcileStock, recordStockAdjustment } from '../../api/stockLedger';
import type { StockAdjustmentType, StockSnapshot } from '../../domain/stockLedger';
import type { FishVariety } from '../../types';
import styles from '../../styles/StockLedgerScreen.styles';

type AdjustmentMode = StockAdjustmentType | 'reconciliation';

type Props = {
  visible: boolean;
  date: string;
  varieties: FishVariety[];
  snapshots: StockSnapshot[];
  initialVariantId?: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

const modes: Array<{ value: AdjustmentMode; label: string }> = [
  { value: 'reconciliation', label: 'Count stock' },
  { value: 'adjustment_in', label: 'Add stock' },
  { value: 'adjustment_out', label: 'Remove' },
  { value: 'wastage', label: 'Wastage' },
  { value: 'sale_return', label: 'Sales return' },
  { value: 'purchase_return', label: 'Supplier return' },
];

const reasonSuggestions: Record<AdjustmentMode, string[]> = {
  reconciliation: ['Physical count', 'Opening verification'],
  adjustment_in: ['Opening balance', 'Unrecorded receipt'],
  adjustment_out: ['Counting correction', 'Internal use'],
  wastage: ['Spoilage', 'Damage', 'Weight loss'],
  sale_return: ['Customer return'],
  purchase_return: ['Returned to supplier'],
};

export default function StockAdjustmentModal(props: Props) {
  const [mode, setMode] = useState<AdjustmentMode>('reconciliation');
  const [variantId, setVariantId] = useState<number | null>(props.initialVariantId ?? null);
  const [crates, setCrates] = useState('');
  const [kg, setKg] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showItemSelect, setShowItemSelect] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.visible) {
      setVariantId(props.initialVariantId ?? null);
      setMode('reconciliation');
      setCrates('');
      setKg('');
      setReason('');
      setNotes('');
    }
  }, [props.initialVariantId, props.visible]);

  const selectedVariant = props.varieties.find((variant) => variant.id === variantId);
  const current = props.snapshots.find((snapshot) => snapshot.itemVariantId === variantId);
  const options = useMemo<SearchableOption[]>(() => props.varieties.map((variant) => ({
    id: variant.id,
    label: variant.name,
    detail: variant.variant_code,
    searchText: [variant.item_name, variant.grade_code].filter(Boolean).join(' '),
  })), [props.varieties]);

  const submit = async () => {
    if (!variantId) {
      Alert.alert('Item required', 'Select an item and grade.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Every stock change needs an audit reason.');
      return;
    }

    const crateValue = Number.parseInt(crates, 10) || 0;
    const kgValue = Number.parseFloat(kg) || 0;
    if (crateValue < 0 || kgValue < 0) {
      Alert.alert('Invalid quantity', 'Stock quantities cannot be negative.');
      return;
    }
    if (mode !== 'reconciliation' && crateValue === 0 && kgValue === 0) {
      Alert.alert('Quantity required', 'Enter crates, kilograms, or both.');
      return;
    }
    if (mode === 'reconciliation' && crates.trim() === '' && kg.trim() === '') {
      Alert.alert('Count required', 'Enter the physically counted crates and kilograms.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'reconciliation') {
        await reconcileStock({
          itemVariantId: variantId,
          date: props.date,
          countedCrates: crateValue,
          countedKg: kgValue,
          reason,
          notes,
        });
      } else {
        await recordStockAdjustment({
          itemVariantId: variantId,
          date: props.date,
          type: mode,
          crates: crateValue,
          kg: kgValue,
          reason,
          notes,
        });
      }
      await props.onSaved();
      props.onClose();
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : 'Unable to save stock change';
      Alert.alert('Stock was not changed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.sheetOverlay}>
        <View style={styles.adjustmentSheet}>
          <View style={styles.sheetHeader}>
            <View><Text style={styles.sheetTitle}>Stock control</Text><Text style={styles.sheetSubtitle}>Every change is recorded in the ledger</Text></View>
            <TouchableOpacity onPress={props.onClose}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Item / grade</Text>
            <TouchableOpacity style={styles.selectField} onPress={() => setShowItemSelect(true)}>
              <Text style={selectedVariant ? styles.selectValue : styles.selectPlaceholder}>{selectedVariant?.name ?? 'Search item or grade'}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {variantId ? (
              <View style={styles.currentStockBanner}>
                <Text style={styles.currentStockLabel}>Ledger stock on this date</Text>
                <Text style={styles.currentStockValue}>{current?.closingCrates ?? 0} cr · {current?.closingKg ?? 0} kg</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Action</Text>
            <View style={styles.modeGrid}>
              {modes.map((item) => (
                <TouchableOpacity key={item.value} style={[styles.modeChip, mode === item.value && styles.modeChipActive]} onPress={() => { setMode(item.value); setReason(''); }}>
                  <Text style={[styles.modeChipText, mode === item.value && styles.modeChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{mode === 'reconciliation' ? 'Physical count' : 'Quantity'}</Text>
            <View style={styles.quantityRow}>
              <View style={styles.quantityField}><Text style={styles.quantityLabel}>Crates</Text><TextInput style={styles.input} value={crates} onChangeText={setCrates} keyboardType="number-pad" placeholder="0" /></View>
              <View style={styles.quantityField}><Text style={styles.quantityLabel}>Kg</Text><TextInput style={styles.input} value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="0" /></View>
            </View>

            {mode === 'reconciliation' && variantId ? (
              <Text style={styles.differenceHint}>
                Difference: {(Number.parseInt(crates, 10) || 0) - (current?.closingCrates ?? 0)} cr · {(Number.parseFloat(kg) || 0) - (current?.closingKg ?? 0)} kg
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Reason *</Text>
            <View style={styles.reasonChips}>
              {reasonSuggestions[mode].map((suggestion) => (
                <TouchableOpacity key={suggestion} style={[styles.reasonChip, reason === suggestion && styles.reasonChipActive]} onPress={() => setReason(suggestion)}>
                  <Text style={[styles.reasonChipText, reason === suggestion && styles.reasonChipTextActive]}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Or enter a specific reason" />

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes} placeholder="Additional context" multiline />

            <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>{mode === 'reconciliation' ? 'Reconcile stock' : 'Record adjustment'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <SearchableSelectModal
        visible={showItemSelect}
        title="Select item and grade"
        searchPlaceholder="Search item, code or grade"
        options={options}
        emptyMessage="No active catalog item found"
        onSelect={setVariantId}
        onClose={() => setShowItemSelect(false)}
      />
    </Modal>
  );
}
