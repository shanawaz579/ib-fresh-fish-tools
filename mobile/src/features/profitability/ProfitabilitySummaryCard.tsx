import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { ProfitabilityReport } from '../../types';
import styles from '../../styles/ProfitabilityScreen.styles';

type Props = { report: ProfitabilityReport | null; loading: boolean; formatMoney: (amount: number, fractionDigits?: number) => string };

export default function ProfitabilitySummaryCard({ report, loading, formatMoney }: Props) {
  const net = report?.net_profit ?? 0;
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View><Text style={styles.summaryEyebrow}>NET PROFIT</Text>{loading ? <ActivityIndicator color="#FFFFFF" style={styles.loader} /> : <Text style={styles.summaryAmount}>{formatMoney(net, 2)}</Text>}</View>
        <View style={[styles.statusBadge, report?.is_complete ? styles.completeBadge : styles.provisionalBadge]}><Text style={styles.statusText}>{report?.is_complete ? 'COMPLETE' : 'PROVISIONAL'}</Text></View>
      </View>
      <View style={styles.metricRow}>
        <View><Text style={styles.metricLabel}>REVENUE</Text><Text style={styles.metricValue}>{formatMoney(report?.revenue ?? 0, 0)}</Text></View>
        <View><Text style={styles.metricLabel}>GROSS PROFIT</Text><Text style={styles.metricValue}>{formatMoney(report?.gross_profit ?? 0, 0)}</Text></View>
        <View><Text style={styles.metricLabel}>EXPENSES</Text><Text style={styles.metricValue}>{formatMoney(report?.operating_expenses ?? 0, 0)}</Text></View>
      </View>
    </View>
  );
}
