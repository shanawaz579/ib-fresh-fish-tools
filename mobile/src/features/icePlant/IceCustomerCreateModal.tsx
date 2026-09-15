import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from '../../styles/IceFinanceScreen.styles';

type Props = { visible: boolean; saving: boolean; onClose: () => void; onSave: (name: string) => Promise<boolean> };

export default function IceCustomerCreateModal({ visible, saving, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  useEffect(() => { if (!visible) setName(''); }, [visible]);
  const submit = async () => { if (name.trim().length >= 2 && await onSave(name.trim())) onClose(); };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modalCard}><Text style={styles.modalTitle}>New Ice Plant customer</Text><Text style={styles.modalHelp}>Add once, then select this customer for future sales and credit tracking.</Text><Text style={styles.label}>CUSTOMER NAME *</Text><TextInput autoFocus autoCapitalize="words" style={styles.input} value={name} onChangeText={setName} placeholder="Enter customer name" /><View style={styles.modalActions}><TouchableOpacity style={styles.modalCancel} disabled={saving} onPress={onClose}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.modalSave, (saving || name.trim().length < 2) && styles.disabled]} disabled={saving || name.trim().length < 2} onPress={() => { void submit(); }}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Create</Text>}</TouchableOpacity></View></View>
    </KeyboardAvoidingView>
  </Modal>;
}
