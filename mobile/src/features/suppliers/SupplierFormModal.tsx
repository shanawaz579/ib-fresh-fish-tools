import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { SupplierCreateInput, SupplierType } from '../../types';
import styles from '../../styles/FarmersScreen.styles';

type Props = {
  visible: boolean;
  mode: 'add' | 'edit';
  value: SupplierCreateInput;
  submitting: boolean;
  onChange: (value: SupplierCreateInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  onDelete?: () => void;
};

export const emptySupplierForm: SupplierCreateInput = {
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

export default function SupplierFormModal({
  visible,
  mode,
  value,
  submitting,
  onChange,
  onSubmit,
  onClose,
  onDelete,
}: Props) {
  const update = (field: keyof SupplierCreateInput, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const fields: Array<{
    key: keyof SupplierCreateInput;
    label: string;
    placeholder: string;
    required?: boolean;
    keyboardType?: 'default' | 'phone-pad' | 'email-address';
    multiline?: boolean;
  }> = [
    { key: 'name', label: 'Supplier Name', placeholder: 'Enter supplier name', required: true },
    { key: 'location', label: 'Location', placeholder: 'Enter primary location', required: true },
    { key: 'phone', label: 'Phone', placeholder: 'Enter phone number', keyboardType: 'phone-pad' },
    { key: 'email', label: 'Email', placeholder: 'Enter email address', keyboardType: 'email-address' },
    { key: 'address', label: 'Address', placeholder: 'Enter address' },
    { key: 'city', label: 'City', placeholder: 'Enter city' },
    { key: 'state', label: 'State', placeholder: 'Enter state' },
    { key: 'bankAccount', label: 'Bank Account', placeholder: 'Enter bank account number' },
    { key: 'bankName', label: 'Bank Name', placeholder: 'Enter bank name' },
    { key: 'notes', label: 'Notes', placeholder: 'Enter notes (optional)', multiline: true },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{mode === 'add' ? 'Add New Supplier' : 'Edit Supplier'}</Text>

            <Text style={styles.label}>Supplier Type *</Text>
            <View style={styles.modalButtons}>
              {(['mediator', 'farmer'] as SupplierType[]).map((type) => {
                const selected = value.supplierType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => onChange({ ...value, supplierType: type })}
                    style={[styles.modalButton, selected ? styles.saveButton : styles.cancelButton]}
                  >
                    <Text style={selected ? styles.modalButtonText : styles.cancelButtonText}>
                      {type === 'mediator' ? 'Mediator' : 'Direct farmer'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {fields.map((field) => (
              <React.Fragment key={field.key}>
                <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
                <TextInput
                  style={[styles.input, field.multiline && styles.textArea]}
                  placeholder={field.placeholder}
                  placeholderTextColor="#9CA3AF"
                  value={String(value[field.key] ?? '')}
                  keyboardType={field.keyboardType}
                  autoCapitalize={field.key === 'email' ? 'none' : 'sentences'}
                  multiline={field.multiline}
                  numberOfLines={field.multiline ? 3 : 1}
                  onChangeText={(text) => update(field.key, text)}
                />
              </React.Fragment>
            ))}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={onSubmit}
                disabled={submitting}
                style={[styles.modalButton, styles.saveButton, submitting && styles.disabledButton]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>{mode === 'add' ? 'Add Supplier' : 'Save'}</Text>
                )}
              </TouchableOpacity>

              {onDelete ? (
                <TouchableOpacity onPress={onDelete} style={[styles.modalButton, styles.deleteButton]}>
                  <Text style={styles.modalButtonText}>Delete</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={onClose} style={[styles.modalButton, styles.cancelButton]}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
