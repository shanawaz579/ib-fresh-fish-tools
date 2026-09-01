import React from 'react';
import { Text, View } from 'react-native';
import type { DayCloseReadiness } from '../../types';
import styles from '../../styles/CashbookScreen.styles';

type Props = {
  readiness: DayCloseReadiness;
  loading: boolean;
  formatMoney: (amount: number, fractionDigits?: number) => string;
};

const statusCopy = {
  ready: { label: 'READY TO CLOSE', title: 'All operational checks passed', symbol: '✓' },
  blocked: { label: 'ACTION REQUIRED', title: 'Resolve these items before closing', symbol: '!' },
  closed: { label: 'LOCKED', title: 'Business day is closed and audited', symbol: '✓' },
} as const;

export default function DayCloseChecklist({ readiness, loading, formatMoney }: Props) {
  const copy = statusCopy[readiness.status];
  return (
    <View style={styles.card}>
      <View style={styles.checklistHeader}>
        <View style={styles.checklistHeadingCopy}>
          <Text style={styles.checklistEyebrow}>DAY CLOSE CHECKLIST</Text>
          <Text style={styles.cardTitle}>{loading ? 'Checking today’s operations…' : copy.title}</Text>
        </View>
        {!loading ? <View style={[styles.checklistStatus, readiness.status === 'blocked' ? styles.checklistStatusBlocked : styles.checklistStatusReady]}><Text style={styles.checklistStatusSymbol}>{copy.symbol}</Text><Text style={styles.checklistStatusText}>{copy.label}</Text></View> : null}
      </View>

      <View style={styles.activityRow}>
        <View style={styles.activityMetric}><Text style={styles.activityValue}>{readiness.activity.purchases}</Text><Text style={styles.activityLabel}>PURCHASES</Text></View>
        <View style={styles.activityMetric}><Text style={styles.activityValue}>{readiness.activity.purchase_bills}</Text><Text style={styles.activityLabel}>PURCHASE BILLS</Text></View>
        <View style={styles.activityMetric}><Text style={styles.activityValue}>{readiness.activity.sales}</Text><Text style={styles.activityLabel}>SALES</Text></View>
        <View style={styles.activityMetric}><Text style={styles.activityValue}>{readiness.activity.sales_bills}</Text><Text style={styles.activityLabel}>SALES BILLS</Text></View>
      </View>

      {!loading && readiness.issues.map((issue) => (
        <View key={issue.code} style={styles.checkRow}>
          <View style={[styles.checkDot, issue.severity === 'blocker' ? styles.checkDotBlocker : styles.checkDotWarning]}><Text style={styles.checkDotText}>{issue.severity === 'blocker' ? '!' : 'i'}</Text></View>
          <View style={styles.checkCopy}><Text style={styles.checkLabel}>{issue.label}</Text><Text style={styles.checkMeta}>{issue.severity === 'blocker' ? 'Must be resolved' : 'Allowed — follow up later'}</Text></View>
          <View style={styles.checkValueWrap}><Text style={styles.checkCount}>{issue.count}</Text>{issue.amount !== undefined ? <Text style={styles.checkAmount}>{formatMoney(issue.amount, 0)}</Text> : null}</View>
        </View>
      ))}

      {!loading && readiness.issues.length === 0 ? <Text style={styles.allClearText}>No unbilled work, missing rates, packing gaps, or stock exceptions.</Text> : null}
      {!loading && readiness.warning_count > 0 ? <Text style={styles.warningFootnote}>Outstanding customer and supplier balances do not block closing. They remain available in account ledgers.</Text> : null}
    </View>
  );
}
