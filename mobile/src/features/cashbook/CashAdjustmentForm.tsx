import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { CashDirection } from '../../types';
import styles from '../../styles/CashbookScreen.styles';

type Props = {
  currencySymbol: string;
  submitting: boolean;
  onSave: (direction: CashDirection, amount: string, reason: string, reference: string) => Promise<boolean>;
};

export default function CashAdjustmentForm({ currencySymbol, submitting, onSave }: Props) {
  const [direction, setDirection] = useState<CashDirection>('in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const save = async () => {
    if (await onSave(direction, amount, reason, reference)) {
      setAmount(''); setReason(''); setReference('');
    }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Cash adjustment</Text>
      <Text style={styles.cardSubtitle}>For opening cash, owner deposits, withdrawals, or corrections</Text>
      <Text style={styles.fieldLabel}>DIRECTION *</Text>
      <View style={styles.segmentRow}>
        {(['in', 'out'] as CashDirection[]).map((value) => (
          <TouchableOpacity key={value} style={[styles.segment, direction === value && (value === 'in' ? styles.segmentIn : styles.segmentOut)]} onPress={() => setDirection(value)}>
            <Text style={[styles.segmentText, direction === value && styles.segmentTextOn]}>{value === 'in' ? '↓ Cash in' : '↑ Cash out'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.fieldLabel}>AMOUNT *</Text>
      <View style={styles.amountInputWrap}><Text style={styles.currency}>{currencySymbol}</Text><TextInput style={styles.amountInput} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" /></View>
      <Text style={styles.fieldLabel}>REASON *</Text>
      <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Example: Opening cash balance" />
      <Text style={styles.fieldLabel}>REFERENCE (OPTIONAL)</Text>
      <TextInput style={styles.input} value={reference} onChangeText={setReference} placeholder="Voucher or note number" autoCapitalize="characters" />
      <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabled]} onPress={save} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Add adjustment</Text>}
      </TouchableOpacity>
    </View>
  );
}
