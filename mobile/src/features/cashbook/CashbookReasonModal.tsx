import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from '../../styles/CashbookScreen.styles';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
};

export default function CashbookReasonModal(props: Props) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (!props.visible) setReason(''); }, [props.visible]);
  const confirm = async () => {
    if (reason.trim().length < 3) return;
    if (await props.onConfirm(reason)) props.onClose();
  };
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={styles.modalOverlay}><View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{props.title}</Text>
        <Text style={styles.modalMessage}>{props.message}</Text>
        <TextInput style={[styles.input, styles.noteInput]} value={reason} onChangeText={setReason} placeholder="Required audit reason" multiline autoFocus />
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalCancel} onPress={props.onClose}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modalConfirm, (reason.trim().length < 3 || props.submitting) && styles.disabled]} disabled={reason.trim().length < 3 || props.submitting} onPress={confirm}>
            {props.submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Confirm</Text>}
          </TouchableOpacity>
        </View>
      </View></View>
    </Modal>
  );
}
