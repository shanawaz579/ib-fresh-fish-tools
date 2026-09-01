import React from 'react';
import { Text, View } from 'react-native';
import type { CashbookDay } from '../../types';
import styles from '../../styles/CashbookScreen.styles';

type Props = { day: CashbookDay; formatMoney: (amount: number, fractionDigits?: number) => string };

export default function CashFlowBreakdown({ day, formatMoney }: Props) {
  const rows = [
    { label: 'Opening cash', amount: day.opening_cash, kind: 'neutral' },
    { label: 'Customer receipts', amount: day.cash_received, kind: 'in' },
    { label: 'Cash adjustments in', amount: day.cash_adjustments_in, kind: 'in' },
    { label: 'Supplier payments', amount: day.cash_supplier_payments, kind: 'out' },
    { label: 'Cash expenses', amount: day.cash_expenses, kind: 'out' },
    { label: 'Cash adjustments out', amount: day.cash_adjustments_out, kind: 'out' },
  ] as const;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Cash movement</Text>
      <Text style={styles.cardSubtitle}>Automatically consolidated from recorded transactions</Text>
      <View style={styles.flowList}>
        {rows.map((row) => (
          <View key={row.label} style={styles.flowRow}>
            <View style={[styles.flowSign, row.kind === 'in' ? styles.flowSignIn : row.kind === 'out' ? styles.flowSignOut : styles.flowSignNeutral]}>
              <Text style={styles.flowSignText}>{row.kind === 'in' ? '+' : row.kind === 'out' ? '−' : '•'}</Text>
            </View>
            <Text style={styles.flowLabel}>{row.label}</Text>
            <Text style={[styles.flowAmount, row.kind === 'in' && styles.inText, row.kind === 'out' && styles.outText]}>{formatMoney(row.amount, 0)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
