import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BRAND_COLORS } from '../config/brandTheme';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import type { AccountLedgerEntry } from '../domain/accountLedger';
import { formatBusinessDate } from '../utils/date';

type Props = {
  entries: AccountLedgerEntry[];
  onOpenBill?: (billId: number) => void;
  onVoidPayment?: (paymentId: number) => void;
  paymentLabel?: string;
};

export default function AccountActivityList({ entries, onOpenBill, onVoidPayment, paymentLabel = 'Payment' }: Props) {
  const { formatMoney } = useBusinessConfig();
  return (
    <View style={styles.section}>
      <View style={styles.heading}><Text style={styles.title}>Account activity</Text><Text style={styles.count}>{entries.length}</Text></View>
      {entries.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>No account activity up to this date</Text></View> : entries.map(entry => {
        const isVoided = entry.type === 'voided_payment';
        const isPayment = entry.type === 'payment';
        const canOpen = entry.type === 'bill' && Boolean(entry.billId && onOpenBill);
        return (
          <View key={entry.key} style={[styles.row, isVoided && styles.voided]}>
            <TouchableOpacity style={styles.left} disabled={!canOpen} onPress={() => entry.billId && onOpenBill?.(entry.billId)}>
              <Text style={[styles.reference, isVoided && styles.strike]}>{entry.type === 'opening_balance' ? 'Opening balance' : entry.type === 'bill' ? `Bill ${entry.reference}${canOpen ? '  ›' : ''}` : isVoided ? `Voided ${paymentLabel.toLocaleLowerCase()}` : paymentLabel}</Text>
              <Text style={styles.meta}>{formatBusinessDate(entry.date)}{entry.paymentMode ? ` · ${entry.paymentMode.replace('_', ' ').toUpperCase()}` : ''}{entry.type === 'payment' && entry.reference !== 'Receipt' ? ` · ${entry.reference}` : ''}</Text>
              {isVoided && entry.voidReason ? <Text style={styles.reason}>{entry.voidReason}</Text> : null}
            </TouchableOpacity>
            <View style={styles.right}>
              <Text style={[styles.amount, entry.direction === 'credit' && styles.paid, isVoided && styles.strike]}>{entry.direction === 'debit' ? '+' : entry.direction === 'credit' ? '−' : ''}{formatMoney(entry.amount, 0)}</Text>
              <Text style={styles.balance}>Balance {entry.balanceAfter < 0 ? 'credit ' : ''}{formatMoney(Math.abs(entry.balanceAfter), 0)}</Text>
              {isPayment && entry.paymentId && onVoidPayment ? <TouchableOpacity style={styles.voidButton} onPress={() => onVoidPayment(entry.paymentId!)}><Text style={styles.voidText}>Void</Text></TouchableOpacity> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 }, heading: { alignItems: 'center', flexDirection: 'row', marginBottom: 9 }, title: { color: BRAND_COLORS.ink, fontSize: 17, fontWeight: '900' }, count: { backgroundColor: '#E2E8F0', borderRadius: 10, color: '#475569', fontSize: 10, fontWeight: '900', marginLeft: 7, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  empty: { alignItems: 'center', backgroundColor: '#FFF', borderColor: BRAND_COLORS.border, borderRadius: 12, borderWidth: 1, padding: 20 }, emptyText: { color: '#94A3B8', fontSize: 12 },
  row: { alignItems: 'center', backgroundColor: '#FFF', borderColor: BRAND_COLORS.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7, padding: 11 }, voided: { backgroundColor: '#F8FAFC', opacity: .75 }, left: { flex: 1, paddingRight: 8 }, right: { alignItems: 'flex-end' }, reference: { color: '#334155', fontSize: 13, fontWeight: '800' }, meta: { color: '#94A3B8', fontSize: 10, marginTop: 3 }, reason: { color: '#DC2626', fontSize: 9, marginTop: 2 }, amount: { color: '#B45309', fontSize: 13, fontWeight: '900' }, paid: { color: BRAND_COLORS.primary }, balance: { color: BRAND_COLORS.muted, fontSize: 9, marginTop: 3 }, strike: { color: BRAND_COLORS.muted, textDecorationLine: 'line-through' }, voidButton: { marginTop: 5, padding: 3 }, voidText: { color: '#DC2626', fontSize: 9, fontWeight: '800' },
});
