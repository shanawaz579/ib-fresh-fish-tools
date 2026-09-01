import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Payment } from '../../types';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type Props = { payment: Payment | null; saving: boolean; onClose: () => void; onConfirm: (reason: string) => void };

export default function PaymentVoidModal({ payment, saving, onClose, onConfirm }: Props) {
  const { formatMoney } = useBusinessConfig();
  const [reason, setReason] = useState('');
  useEffect(() => { if (payment) setReason(''); }, [payment]);
  return (
    <Modal visible={Boolean(payment)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}><View style={styles.card}>
        <Text style={styles.title}>Void payment?</Text>
        <Text style={styles.text}>{formatMoney(payment?.amount ?? 0, 0)} will be removed from the account balance but retained in audit history.</Text>
        <Text style={styles.label}>REASON *</Text>
        <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Why is this receipt being voided?" multiline autoFocus />
        <View style={styles.actions}><TouchableOpacity style={styles.cancel} onPress={onClose} disabled={saving}><Text style={styles.cancelText}>Keep payment</Text></TouchableOpacity><TouchableOpacity style={[styles.void, (!reason.trim() || saving) && styles.disabled]} onPress={() => onConfirm(reason.trim())} disabled={!reason.trim() || saving}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.voidText}>Void payment</Text>}</TouchableOpacity></View>
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.5)', flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, width: '100%' }, title: { color: '#0F172A', fontSize: 19, fontWeight: '900' },
  text: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 7 }, label: { color: '#64748B', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', borderRadius: 10, borderWidth: 1, minHeight: 76, padding: 11, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 16 }, cancel: { alignItems: 'center', borderColor: '#CBD5E1', borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  cancelText: { color: '#475569', fontSize: 13, fontWeight: '800' }, void: { alignItems: 'center', backgroundColor: '#DC2626', borderRadius: 10, flex: 1, justifyContent: 'center', minHeight: 46 },
  voidText: { color: '#FFF', fontSize: 13, fontWeight: '900' }, disabled: { opacity: 0.5 },
});
