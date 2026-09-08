import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import styles from '../../styles/SalesScreen.styles';

type Props = {
  visible: boolean;
  customerName?: string;
  billed: boolean;
  onClose: () => void;
  onEdit: () => void;
};

export default function ExistingSaleModal({ visible, customerName, billed, onClose, onEdit }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.existingSaleBackdrop}>
        <View style={styles.existingSaleModal}>
          <View style={styles.existingSaleIcon}><Text style={styles.existingSaleIconText}>✓</Text></View>
          <Text style={styles.existingSaleTitle}>Sale already exists</Text>
          <Text style={styles.existingSaleBody}>
            {customerName} already has a sale for this date. Keep all items in the same sale to avoid duplicates.
          </Text>
          {billed ? <Text style={styles.existingSaleHint}>This sale is billed, so changes will be recorded as a bill correction.</Text> : null}
          <View style={styles.existingSaleActions}>
            <TouchableOpacity style={styles.existingSaleCancel} onPress={onClose}><Text style={styles.existingSaleCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.existingSaleEdit} onPress={onEdit}><Text style={styles.existingSaleEditText}>{billed ? 'Correct bill' : 'Edit sale'}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
