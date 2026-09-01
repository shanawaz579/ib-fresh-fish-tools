import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useBusinessConfig } from '../../context/BusinessConfigContext';
import type { Expense } from '../../types';
import styles from '../../styles/ExpensesScreen.styles';

type Props = {
  expense: Expense | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export default function ExpenseVoidModal({ expense, saving, onClose, onConfirm }: Props) {
  const { formatMoney } = useBusinessConfig();
  const [reason, setReason] = useState('');
  useEffect(() => { if (expense) setReason(''); }, [expense]);

  return (
    <Modal visible={Boolean(expense)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Void this expense?</Text>
          <Text style={styles.modalText}>
            {formatMoney(expense?.amount ?? 0, 2)} will be excluded from totals but retained in audit history.
          </Text>
          <Text style={styles.fieldLabel}>REASON *</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={reason}
            onChangeText={setReason}
            placeholder="Explain why this entry is incorrect"
            multiline
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose} disabled={saving}>
              <Text style={styles.modalCancelText}>Keep expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voidConfirm, (saving || reason.trim().length < 3) && styles.disabled]}
              onPress={() => onConfirm(reason.trim())}
              disabled={saving || reason.trim().length < 3}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalConfirmText}>Void expense</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
