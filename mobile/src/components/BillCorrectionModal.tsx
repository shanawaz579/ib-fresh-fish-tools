import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  billNumber?: string;
  documentLabel: 'sales bill' | 'purchase bill';
  saving: boolean;
  action?: 'correct' | 'delete';
  paymentsCarriedForward?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export default function BillCorrectionModal({
  visible,
  billNumber,
  documentLabel,
  saving,
  action = 'correct',
  paymentsCarriedForward = false,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (visible) setReason(''); }, [visible, billNumber]);
  const valid = reason.trim().length >= 5;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.icon}><Text style={styles.iconText}>↺</Text></View>
          <Text style={styles.title}>{action === 'delete' ? 'Delete' : 'Correct'} {documentLabel}</Text>
          <Text style={styles.text}>
            {billNumber ? `${billNumber} will be retained in correction history. ` : ''}
            Its source items will return to unbilled{action === 'delete' ? '.' : ' so you can generate the corrected bill.'}
          </Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{paymentsCarriedForward
              ? 'Valid payments will move to the corrected bill automatically. Void only payments that are themselves incorrect.'
              : 'Payments must be voided before a financial bill can be corrected.'}</Text>
          </View>
          <Text style={styles.label}>CORRECTION REASON *</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Example: incorrect rate entered"
            multiline
            autoFocus
            editable={!saving}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>Minimum 5 characters. This reason is stored in the audit trail.</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Keep bill</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.correct, (!valid || saving) && styles.disabled]}
              onPress={() => onConfirm(reason.trim())}
              disabled={!valid || saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.correctText}>{action === 'delete' ? 'Delete bill' : 'Continue'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.56)', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 19, width: '100%' },
  icon: { alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, height: 42, justifyContent: 'center', width: 42 },
  iconText: { color: '#B45309', fontSize: 24, fontWeight: '800' },
  title: { color: '#0F172A', fontSize: 20, fontWeight: '900', marginTop: 12 },
  text: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 6 },
  notice: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderRadius: 10, borderWidth: 1, marginTop: 12, padding: 10 },
  noticeText: { color: '#9A3412', fontSize: 11, fontWeight: '700', lineHeight: 16 },
  label: { color: '#64748B', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 6, marginTop: 15 },
  input: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', borderRadius: 11, borderWidth: 1, color: '#0F172A', minHeight: 82, padding: 11 },
  hint: { color: '#94A3B8', fontSize: 10, lineHeight: 14, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  cancel: { alignItems: 'center', borderColor: '#CBD5E1', borderRadius: 11, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  cancelText: { color: '#475569', fontSize: 13, fontWeight: '800' },
  correct: { alignItems: 'center', backgroundColor: '#B45309', borderRadius: 11, flex: 1, justifyContent: 'center', minHeight: 48 },
  correctText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
