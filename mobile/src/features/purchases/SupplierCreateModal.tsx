import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { SupplierCreateInput, SupplierType } from '../../types';
import styles from '../../styles/PurchaseScreen.styles';

type Props = {
  visible: boolean;
  saving: boolean;
  onSave: (input: SupplierCreateInput) => Promise<boolean>;
  onClose: () => void;
};

const emptyForm: SupplierCreateInput = {
  supplierType: 'mediator',
  name: '',
  location: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  bankAccount: '',
  bankName: '',
  notes: '',
};

export default function SupplierCreateModal({ visible, saving, onSave, onClose }: Props) {
  const [form, setForm] = useState<SupplierCreateInput>(emptyForm);

  useEffect(() => {
    if (!visible) setForm(emptyForm);
  }, [visible]);

  const update = (field: keyof SupplierCreateInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setSupplierType = (supplierType: SupplierType) => {
    setForm((current) => ({ ...current, supplierType }));
  };

  const submit = async () => {
    if (!form.name.trim() || !form.location.trim()) return;
    if (await onSave(form)) onClose();
  };

  const incomplete = !form.name.trim() || !form.location.trim();
  const typeLabel = form.supplierType === 'farmer' ? 'Farmer' : 'Mediator';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalCard, styles.mediatorModalCard]}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.modalTitle}>Create primary supplier</Text>
              <Text style={styles.modalSubtitle}>This account will receive purchase bills.</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} disabled={saving}>
              <Text style={styles.sheetClose}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Supplier type *</Text>
            <View style={styles.typeSelector}>
              {(['mediator', 'farmer'] as SupplierType[]).map((type) => {
                const selected = form.supplierType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, selected && styles.typeOptionSelected]}
                    onPress={() => setSupplierType(type)}
                  >
                    <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                      {type === 'mediator' ? 'Mediator' : 'Direct farmer'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>{typeLabel} name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(value) => update('name', value)} autoCapitalize="words" placeholder={`${typeLabel} name`} />

            <Text style={styles.label}>Location *</Text>
            <TextInput style={styles.input} value={form.location} onChangeText={(value) => update('location', value)} autoCapitalize="words" placeholder="Primary location" />

            <Text style={styles.optionalSectionTitle}>Optional payment and contact details</Text>
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" placeholder="Phone number" />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(value) => update('email', value)} keyboardType="email-address" autoCapitalize="none" placeholder="Email address" />
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={(value) => update('address', value)} placeholder="Full address" />

            <View style={styles.quantityRow}>
              <View style={styles.fieldColumn}>
                <Text style={styles.label}>City</Text>
                <TextInput style={styles.input} value={form.city} onChangeText={(value) => update('city', value)} placeholder="City" />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={styles.label}>State</Text>
                <TextInput style={styles.input} value={form.state} onChangeText={(value) => update('state', value)} placeholder="State" />
              </View>
            </View>

            <Text style={styles.label}>Bank account</Text>
            <TextInput style={styles.input} value={form.bankAccount} onChangeText={(value) => update('bankAccount', value)} placeholder="Account number" />
            <Text style={styles.label}>Bank name</Text>
            <TextInput style={styles.input} value={form.bankName} onChangeText={(value) => update('bankName', value)} placeholder="Bank name" />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={form.notes} onChangeText={(value) => update('notes', value)} placeholder="Optional notes" multiline />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalSaveButton, (incomplete || saving) && styles.disabledButton]} onPress={submit} disabled={incomplete || saving}>
              <Text style={styles.modalSaveText}>{saving ? 'Creating…' : 'Create supplier'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
