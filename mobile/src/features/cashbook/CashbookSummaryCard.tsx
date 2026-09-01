import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { cashbookMovementTotals } from '../../domain/cashbook';
import type { CashbookDay } from '../../types';
import styles from '../../styles/CashbookScreen.styles';

type Props = {
  day: CashbookDay;
  loading: boolean;
  formatMoney: (amount: number, fractionDigits?: number) => string;
};

export default function CashbookSummaryCard({ day, loading, formatMoney }: Props) {
  const movements = cashbookMovementTotals(day);
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View>
          <Text style={styles.summaryEyebrow}>EXPECTED CASH IN HAND</Text>
          {loading ? <ActivityIndicator color="#FFFFFF" style={styles.summaryLoader} /> : (
            <Text style={styles.summaryAmount}>{formatMoney(day.expected_closing_cash, 2)}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, day.is_closed && styles.statusBadgeClosed]}>
          <Text style={styles.statusText}>{day.is_closed ? 'CLOSED' : 'OPEN'}</Text>
        </View>
      </View>
      <View style={styles.summaryMetrics}>
        <View><Text style={styles.metricLabel}>OPENING</Text><Text style={styles.metricValue}>{formatMoney(day.opening_cash, 0)}</Text></View>
        <View><Text style={styles.metricLabel}>CASH IN</Text><Text style={styles.metricValue}>{formatMoney(movements.totalIn, 0)}</Text></View>
        <View><Text style={styles.metricLabel}>CASH OUT</Text><Text style={styles.metricValue}>{formatMoney(movements.totalOut, 0)}</Text></View>
      </View>
    </View>
  );
}
