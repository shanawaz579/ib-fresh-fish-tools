import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import type { FishVariety } from '../../types';
import type { PurchaseGroup } from './usePurchaseRecords';
import styles from '../../styles/PurchaseScreen.styles';

export type PurchaseGroupEditItem = {
  id: number;
  fishVarietyId: number;
  quantityCrates: string;
  quantityKg: string;
};

type Props = {
  group: PurchaseGroup | null;
  varieties: FishVariety[];
  saving: boolean;
  onCancel: () => void;
  onSave: (items: Array<{
    id: number;
    fishVarietyId: number;
    quantityCrates: number;
    quantityKg: number;
  }>) => Promise<boolean>;
};

export default function PurchaseGroupEditModal({ group, varieties, saving, onCancel, onSave }: Props) {
  const [items, setItems] = useState<PurchaseGroupEditItem[]>([]);

  useEffect(() => {
    setItems((group?.purchases ?? [])
      .filter((purchase) => purchase.billing_status === 'unbilled')
      .map((purchase) => ({
        id: purchase.id,
        fishVarietyId: purchase.fish_variety_id,
        quantityCrates: String(purchase.quantity_crates || ''),
        quantityKg: String(purchase.quantity_kg || ''),
      })));
  }, [group]);

  const updateItem = (id: number, changes: Partial<PurchaseGroupEditItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  };

  const removeItem = (id: number) => {
    if (items.length === 1) {
      Alert.alert('One item required', 'A purchase must contain at least one item.');
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const submit = async () => {
    const parsed = items.map((item) => ({
      id: item.id,
      fishVarietyId: item.fishVarietyId,
      quantityCrates: Number.parseInt(item.quantityCrates, 10) || 0,
      quantityKg: Number.parseFloat(item.quantityKg) || 0,
    }));

    if (new Set(parsed.map((item) => item.fishVarietyId)).size !== parsed.length) {
      Alert.alert('Duplicate item', 'Each item and grade can appear only once.');
      return;
    }
    if (parsed.some((item) => !item.fishVarietyId
      || item.quantityCrates < 0
      || item.quantityKg < 0
      || (item.quantityCrates === 0 && item.quantityKg === 0))) {
      Alert.alert('Check quantities', 'Each line needs crates, kg, or both.');
      return;
    }

    await onSave(parsed);
  };

  return (
    <Modal visible={group !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, styles.groupEditModal]}>
          <Text style={styles.modalTitle}>Edit unbilled purchase</Text>
          <Text style={styles.modalSubtitle}>{group?.supplierName} · all lines save together</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <View key={item.id} style={styles.editLineCard}>
                <View style={styles.editLineHeader}>
                  <Text style={styles.editLineTitle}>Item and grade</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Text style={styles.deleteText}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.pickerFrame}>
                  <Picker
                    selectedValue={item.fishVarietyId}
                    onValueChange={(fishVarietyId) => updateItem(item.id, { fishVarietyId })}
                  >
                    {varieties.map((variant) => (
                      <Picker.Item key={variant.id} label={variant.name} value={variant.id} />
                    ))}
                  </Picker>
                </View>
                <View style={styles.quantityRow}>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.label}>Crates</Text>
                    <TextInput
                      style={styles.input}
                      value={item.quantityCrates}
                      onChangeText={(quantityCrates) => updateItem(item.id, { quantityCrates })}
                      keyboardType="number-pad"
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.label}>Kg</Text>
                    <TextInput
                      style={styles.input}
                      value={item.quantityKg}
                      onChangeText={(quantityKg) => updateItem(item.id, { quantityKg })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onCancel} disabled={saving}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveButton} onPress={submit} disabled={saving}>
              <Text style={styles.modalSaveText}>{saving ? 'Saving…' : 'Save purchase'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
