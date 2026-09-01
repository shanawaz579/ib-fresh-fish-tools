import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import styles from '../../styles/ExpensesScreen.styles';

type Props = {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<boolean>;
};

export default function ExpenseCategoryModal({ visible, saving, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  useEffect(() => { if (!visible) setName(''); }, [visible]);

  const submit = async () => {
    if (name.trim().length < 2) return;
    if (await onSave(name.trim())) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>New expense category</Text>
          <Text style={styles.modalText}>Add a reusable category for this trader.</Text>
          <Text style={styles.fieldLabel}>CATEGORY NAME *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Example: Equipment repair"
            autoCapitalize="words"
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose} disabled={saving}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirm, (saving || name.trim().length < 2) && styles.disabled]}
              onPress={submit}
              disabled={saving || name.trim().length < 2}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalConfirmText}>Create</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
