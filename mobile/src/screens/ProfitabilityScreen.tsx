import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import ProfitabilityBreakdown from '../features/profitability/ProfitabilityBreakdown';
import ProfitabilitySummaryCard from '../features/profitability/ProfitabilitySummaryCard';
import { type ProfitabilityRange, useProfitability } from '../features/profitability/useProfitability';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/ProfitabilityScreen.styles';
import { formatBusinessDate, toLocalDateString } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'Profitability'>;

const ranges: Array<{ value: ProfitabilityRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'seven_days', label: '7 Days' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

export default function ProfitabilityScreen({ navigation }: Props) {
  const profitability = useProfitability();
  const { formatMoney } = useBusinessConfig();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backIcon}>‹</Text></TouchableOpacity>
        <View><Text style={styles.eyebrow}>BUSINESS PERFORMANCE</Text><Text style={styles.title}>Profitability</Text></View>
      </View>
      {profitability.range !== 'custom' ? <DateNavigator date={profitability.date} onPrevious={profitability.goToPreviousDay} onNext={profitability.goToNextDay} onToday={profitability.goToToday} canGoNext={profitability.date < toLocalDateString()} accentColor="#5B21B6" /> : null}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.rangeRow}>{ranges.map((range) => <TouchableOpacity key={range.value} style={[styles.rangeChip, profitability.range === range.value && styles.rangeChipOn]} onPress={() => profitability.setRange(range.value)}><Text style={[styles.rangeText, profitability.range === range.value && styles.rangeTextOn]}>{range.label}</Text></TouchableOpacity>)}</View>
        {profitability.range === 'custom' ? (
          <View style={styles.customRangeCard}>
            <View style={styles.dateField}><Text style={styles.dateLabel}>FROM</Text><TextInput style={styles.dateInput} value={profitability.customFrom} onChangeText={profitability.setCustomFrom} placeholder="YYYY-MM-DD" autoCapitalize="none" /></View>
            <View style={styles.dateDivider}><Text style={styles.dateDividerText}>→</Text></View>
            <View style={styles.dateField}><Text style={styles.dateLabel}>TO</Text><TextInput style={styles.dateInput} value={profitability.customTo} onChangeText={profitability.setCustomTo} placeholder="YYYY-MM-DD" autoCapitalize="none" /></View>
            <TouchableOpacity style={styles.applyButton} onPress={profitability.applyCustomRange}><Text style={styles.applyButtonText}>Apply</Text></TouchableOpacity>
          </View>
        ) : null}
        <Text style={styles.periodText}>{formatBusinessDate(profitability.dateFrom)} – {formatBusinessDate(profitability.dateTo)}</Text>
        <ProfitabilitySummaryCard report={profitability.report} loading={profitability.loading} formatMoney={formatMoney} />
        {profitability.report && !profitability.report.is_complete ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Profit is provisional</Text><Text style={styles.warningText}>{profitability.report.unresolved_sale_count} sale{profitability.report.unresolved_sale_count === 1 ? '' : 's'} need a purchase cost or sales bill. Completed coverage: {profitability.report.coverage_percent}%.</Text><View style={styles.coverageTrack}><View style={[styles.coverageFill, { width: `${Math.max(0, Math.min(100, profitability.report.coverage_percent))}%` }]} /></View></View> : null}
        {profitability.report ? <ProfitabilityBreakdown report={profitability.report} formatMoney={formatMoney} /> : null}
        <View style={styles.methodCard}><Text style={styles.methodTitle}>WEIGHTED-AVERAGE COSTING</Text><Text style={styles.methodText}>Purchase commission and acquisition charges are allocated into item cost. Advances are payment settlements and are excluded. Historical calculation runs remain auditable.</Text></View>
      </ScrollView>
    </View>
  );
}
