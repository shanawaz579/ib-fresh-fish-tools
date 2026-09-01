import React from 'react';
import { Text, View } from 'react-native';
import type { ProfitabilityReport } from '../../types';
import { formatBusinessDate } from '../../utils/date';
import styles from '../../styles/ProfitabilityScreen.styles';

type Props = { report: ProfitabilityReport; formatMoney: (amount: number, fractionDigits?: number) => string };

export default function ProfitabilityBreakdown({ report, formatMoney }: Props) {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profit bridge</Text>
        <View style={styles.bridgeRow}><Text style={styles.bridgeLabel}>Billed sales revenue</Text><Text style={styles.inValue}>{formatMoney(report.revenue, 0)}</Text></View>
        <View style={styles.bridgeRow}><Text style={styles.bridgeLabel}>Weighted-average cost</Text><Text style={styles.outValue}>−{formatMoney(report.cogs, 0)}</Text></View>
        <View style={[styles.bridgeRow, styles.bridgeStrong]}><Text style={styles.bridgeStrongLabel}>Gross profit</Text><Text style={styles.bridgeStrongValue}>{formatMoney(report.gross_profit, 0)}</Text></View>
        <View style={styles.bridgeRow}><Text style={styles.bridgeLabel}>Operating expenses</Text><Text style={styles.outValue}>−{formatMoney(report.operating_expenses, 0)}</Text></View>
      </View>

      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>By item</Text><Text style={styles.sectionMeta}>{report.items.length} items</Text></View>
      {report.items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No sales in this period</Text><Text style={styles.emptyText}>Billed and unbilled sales will appear here.</Text></View> : report.items.map((item) => (
        <View key={item.item_variant_id} style={styles.itemRow}>
          <View style={styles.itemCopy}><Text style={styles.itemName}>{item.item_name}</Text><Text style={styles.itemMeta}>{item.sale_count} sale{item.sale_count === 1 ? '' : 's'}{item.unresolved_count ? ` · ${item.unresolved_count} unresolved` : ''}</Text></View>
          <View style={styles.itemValues}><Text style={styles.itemProfit}>{formatMoney(item.gross_profit, 0)}</Text><Text style={styles.itemRevenue}>{formatMoney(item.revenue, 0)} revenue</Text></View>
        </View>
      ))}

      {report.days.length > 1 ? <><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Daily performance</Text><Text style={styles.sectionMeta}>{report.days.length} days</Text></View>{report.days.map((day) => (
        <View key={day.business_date} style={styles.dayRow}><Text style={styles.dayDate}>{formatBusinessDate(day.business_date)}</Text><View style={styles.dayValues}><Text style={styles.dayProfit}>{formatMoney(day.gross_profit, 0)}</Text>{day.unresolved_count ? <Text style={styles.dayWarning}>{day.unresolved_count} unresolved</Text> : null}</View></View>
      ))}</> : null}
    </>
  );
}
