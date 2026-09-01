import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { cashDifferenceLabel } from '../../domain/cashbook';
import type { CashbookDay } from '../../types';
import styles from '../../styles/CashbookScreen.styles';

type Props = {
  day: CashbookDay;
  currencySymbol: string;
  submitting: boolean;
  formatMoney: (amount: number, fractionDigits?: number) => string;
  onClose: (countedCash: string, notes: string) => Promise<boolean>;
  onRequestReopen: () => void;
  canClose: boolean;
  blockerCount: number;
};

export default function CashClosingCard(props: Props) {
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { setCounted(''); setNotes(''); }, [props.day.business_date]);

  if (props.day.closing) {
    const closing = props.day.closing;
    return (
      <View style={[styles.card, styles.closedCard]}>
        <View style={styles.closedHeading}><View><Text style={styles.cardTitle}>Business day closed</Text><Text style={styles.cardSubtitle}>Transactions and operational records are locked</Text></View><Text style={styles.lockIcon}>✓</Text></View>
        <View style={styles.closedTotals}>
          <View><Text style={styles.metricDarkLabel}>COUNTED</Text><Text style={styles.metricDarkValue}>{props.formatMoney(closing.counted_cash, 2)}</Text></View>
          <View style={styles.alignRight}><Text style={styles.metricDarkLabel}>{cashDifferenceLabel(closing.difference).toUpperCase()}</Text><Text style={[styles.metricDarkValue, closing.difference < 0 ? styles.outText : closing.difference > 0 ? styles.inText : null]}>{props.formatMoney(Math.abs(closing.difference), 2)}</Text></View>
        </View>
        {closing.notes ? <Text style={styles.closingNote}>{closing.notes}</Text> : null}
        <TouchableOpacity style={styles.secondaryButton} onPress={props.onRequestReopen}><Text style={styles.secondaryButtonText}>Reopen with reason</Text></TouchableOpacity>
      </View>
    );
  }

  const countedValue = Number.parseFloat(counted);
  const difference = Number.isFinite(countedValue) ? countedValue - props.day.expected_closing_cash : null;
  const hasInvalidExpectedCash = props.day.expected_closing_cash < 0;
  const closeDisabled = props.submitting || hasInvalidExpectedCash || !props.canClose;
  const confirm = () => Alert.alert(
    'Close and lock this business day?',
    'Purchases, sales, bills, payments, expenses, packing, and stock records for this date will become read-only until an administrator reopens the day.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Close day', onPress: () => { void props.onClose(counted, notes); } }],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Close the day</Text>
      <Text style={styles.cardSubtitle}>Complete operational checks, then count physical cash independently</Text>
      {!props.canClose && props.blockerCount > 0 ? <View style={styles.blockedStrip}><Text style={styles.blockedStripText}>{props.blockerCount} blocking {props.blockerCount === 1 ? 'item' : 'items'} must be resolved first</Text></View> : null}
      <View style={styles.labelRow}><Text style={styles.fieldLabel}>COUNTED CASH *</Text>{!hasInvalidExpectedCash ? <TouchableOpacity onPress={() => setCounted(String(props.day.expected_closing_cash))}><Text style={styles.useExpected}>Use expected</Text></TouchableOpacity> : null}</View>
      <View style={styles.amountInputWrap}><Text style={styles.currency}>{props.currencySymbol}</Text><TextInput style={styles.amountInput} value={counted} onChangeText={setCounted} keyboardType="decimal-pad" placeholder="0" /></View>
      {difference !== null ? <View style={styles.differenceStrip}><Text style={styles.differenceLabel}>{cashDifferenceLabel(difference)}</Text><Text style={[styles.differenceValue, difference < 0 ? styles.outText : difference > 0 ? styles.inText : null]}>{props.formatMoney(Math.abs(difference), 2)}</Text></View> : null}
      <Text style={styles.fieldLabel}>CLOSING NOTE (OPTIONAL)</Text>
      <TextInput style={[styles.input, styles.noteInput]} value={notes} onChangeText={setNotes} placeholder="Explain any shortage, excess, or handover" multiline />
      <TouchableOpacity style={[styles.closeButton, closeDisabled && styles.disabled]} disabled={closeDisabled} onPress={confirm}>
        {props.submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Close and lock day</Text>}
      </TouchableOpacity>
    </View>
  );
}
