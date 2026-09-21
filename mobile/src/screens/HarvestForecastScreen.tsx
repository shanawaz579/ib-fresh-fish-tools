import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHarvestForecast } from '../features/forecast/useHarvestForecast';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/HarvestForecastScreen.styles';
import { addDays, formatBusinessDate, toLocalDateString } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'HarvestForecast'>;

const confidenceCopy = { low: 'Low', medium: 'Medium', high: 'High' } as const;

export default function HarvestForecastScreen({ navigation }: Props) {
  const forecast = useHarvestForecast();
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(forecast.startDate, index)), [forecast.startDate]);
  const isDefaultWeek = forecast.startDate === addDays(toLocalDateString(), 1);
  const [selectedDate, setSelectedDate] = useState(forecast.startDate);
  const [view, setView] = useState<'items' | 'customers' | 'accuracy'>('items');
  useEffect(() => { setSelectedDate(forecast.startDate); }, [forecast.startDate]);
  const selectedRows = forecast.rows
    .filter((row) => row.forecast_date === selectedDate)
    .sort((a, b) => Number(forecast.drafts[b.id] || 0) - Number(forecast.drafts[a.id] || 0));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(forecast.drafts[row.id] || 0), 0);
  const selectedCustomers = useMemo(() => {
    const groups = new Map<number, { id: number; name: string; location: string | null; total: number; items: typeof forecast.customerRows }>();
    forecast.customerRows.filter((row) => row.forecast_date === selectedDate).forEach((row) => {
      const group = groups.get(row.customer_id) ?? { id: row.customer_id, name: row.customer_name, location: row.customer_location, total: 0, items: [] };
      group.total += row.recommended_crates;
      group.items.push(row);
      groups.set(row.customer_id, group);
    });
    return Array.from(groups.values())
      .map((group) => ({ ...group, items: group.items.sort((a, b) => b.recommended_crates - a.recommended_crates) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [forecast.customerRows, selectedDate]);
  const runStatus = forecast.rows[0]?.run_status ?? 'ready';
  const isApproved = runStatus === 'approved';
  const accuracySummary = useMemo(() => {
    const actual = forecast.accuracyRows.reduce((sum, row) => sum + row.actual_crates, 0);
    const error = forecast.accuracyRows.reduce((sum, row) => sum + row.plan_absolute_error, 0);
    return { actual, error, accuracy: actual > 0 ? Math.max(0, 1 - (error / actual)) : null };
  }, [forecast.accuracyRows]);
  const handleApproval = () => {
    if (forecast.hasChanges) {
      Alert.alert('Save changes first', 'Save your planning changes before approving the plan.');
      return;
    }
    Alert.alert(isApproved ? 'Reopen plan?' : 'Approve this plan?', isApproved ? 'The quantities will become editable again.' : 'Approval locks quantities and refresh until you explicitly reopen it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: isApproved ? 'Reopen' : 'Approve', onPress: () => void forecast.setApproval(!isApproved) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backIcon}>‹</Text></TouchableOpacity>
        <View><Text style={styles.eyebrow}>PLANNING ASSISTANT</Text><Text style={styles.title}>Harvest forecast</Text></View>
      </View>

      <View style={styles.weekNavigator}>
        <TouchableOpacity disabled={isDefaultWeek} style={[styles.weekArrow, isDefaultWeek && styles.weekArrowDisabled]} onPress={forecast.previousWeek}><Text style={[styles.weekArrowText, isDefaultWeek && styles.weekArrowTextDisabled]}>←</Text></TouchableOpacity>
        <View style={styles.weekCopy}><Text style={styles.weekLabel}>7-DAY PLAN</Text><Text style={styles.weekDates}>{formatBusinessDate(forecast.startDate)} – {formatBusinessDate(addDays(forecast.startDate, 6))}</Text></View>
        <TouchableOpacity style={styles.weekArrow} onPress={forecast.nextWeek}><Text style={styles.weekArrowText}>→</Text></TouchableOpacity>
        {!isDefaultWeek ? <TouchableOpacity style={styles.nextButton} onPress={forecast.resetToNextWeek}><Text style={styles.nextButtonText}>Next 7 days</Text></TouchableOpacity> : null}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.advisory}>
          <View style={styles.advisoryCopy}><Text style={styles.advisoryTitle}>Planning only</Text><Text style={styles.advisoryText}>Uses eight matching weekdays and customer demand history. It does not reduce stock or create purchases.</Text></View>
          <TouchableOpacity disabled={forecast.loading || isApproved} style={[styles.refreshButton, isApproved && styles.refreshButtonDisabled]} onPress={() => void forecast.refresh()}><Text style={styles.refreshText}>{isApproved ? 'Locked' : 'Refresh'}</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
          {days.map((date) => {
            const dayRows = forecast.rows.filter((row) => row.forecast_date === date);
            const total = dayRows.reduce((sum, row) => sum + Number(forecast.drafts[row.id] || 0), 0);
            const active = selectedDate === date;
            return <TouchableOpacity key={date} style={[styles.dayTab, active && styles.dayTabOn]} onPress={() => setSelectedDate(date)}>
              <Text style={[styles.dayTabName, active && styles.dayTabNameOn]}>{new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
              <Text style={[styles.dayTabDate, active && styles.dayTabDateOn]}>{date.slice(8)}</Text>
              <Text style={[styles.dayTabTotal, active && styles.dayTabTotalOn]}>{total} cr</Text>
            </TouchableOpacity>;
          })}
        </ScrollView>
        <View style={styles.viewSwitch}>
          <TouchableOpacity style={[styles.viewOption, view === 'items' && styles.viewOptionOn]} onPress={() => setView('items')}><Text style={[styles.viewOptionText, view === 'items' && styles.viewOptionTextOn]}>By item</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.viewOption, view === 'customers' && styles.viewOptionOn]} onPress={() => setView('customers')}><Text style={[styles.viewOptionText, view === 'customers' && styles.viewOptionTextOn]}>By customer</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.viewOption, view === 'accuracy' && styles.viewOptionOn]} onPress={() => setView('accuracy')}><Text style={[styles.viewOptionText, view === 'accuracy' && styles.viewOptionTextOn]}>Accuracy</Text></TouchableOpacity>
        </View>
        {view !== 'accuracy' && forecast.rows.length ? <View style={[styles.approvalCard, isApproved && styles.approvalCardOn]}>
          <View style={styles.approvalCopy}><Text style={styles.approvalTitle}>{isApproved ? '✓ Plan approved' : 'Plan is still editable'}</Text><Text style={styles.approvalHint}>{isApproved ? 'Reopen only when quantities must change' : 'Review quantities before locking the plan'}</Text></View>
          <TouchableOpacity disabled={forecast.saving} style={[styles.approvalButton, isApproved && styles.reopenButton]} onPress={handleApproval}><Text style={[styles.approvalButtonText, isApproved && styles.reopenButtonText]}>{isApproved ? 'Reopen' : 'Approve plan'}</Text></TouchableOpacity>
        </View> : null}
        {forecast.loading ? <View style={styles.loading}><ActivityIndicator color="#0F766E" size="large" /><Text style={styles.loadingText}>Preparing recommendations…</Text></View> : null}
        {!forecast.loading && forecast.rows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No crate demand found</Text><Text style={styles.emptyText}>There is not enough matched history for this week yet.</Text></View> : null}

        {!forecast.loading && view === 'items' && selectedRows.length ? (
            <View style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View><Text style={styles.dayName}>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })}</Text><Text style={styles.dayDate}>{formatBusinessDate(selectedDate)}</Text></View>
                <View style={styles.totalPill}><Text style={styles.totalValue}>{selectedTotal}</Text><Text style={styles.totalLabel}>CRATES</Text></View>
              </View>
              {selectedRows.map((row, index) => (
                <View key={row.id} style={[styles.itemRow, index === selectedRows.length - 1 && styles.itemRowLast]}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemName}>{row.variant_name}</Text>
                    <View style={styles.metaRow}>
                      <Text style={[styles.confidence, styles[`confidence${confidenceCopy[row.confidence_label]}`]]}>{confidenceCopy[row.confidence_label]} confidence</Text>
                      {row.model_accuracy !== null ? <Text style={styles.accuracy}>{row.model_accuracy >= 0.2 ? `${Math.round(row.model_accuracy * 100)}% backtest accuracy` : 'Low predictability'}</Text> : null}
                      <Text style={styles.range}>usual {row.low_crates}–{row.high_crates} cr</Text>
                    </View>
                  </View>
                  <View style={styles.quantityBox}>
                    <TextInput
                      style={[styles.quantityInput, row.is_overridden && styles.quantityInputChanged]}
                      value={forecast.drafts[row.id] ?? ''}
                      onChangeText={(value) => forecast.updateDraft(row.id, value)}
                      keyboardType="number-pad"
                      editable={!isApproved}
                      selectTextOnFocus
                      maxLength={4}
                    />
                    <Text style={styles.quantityUnit}>cr</Text>
                  </View>
                </View>
              ))}
            </View>
        ) : null}
        {!forecast.loading && view === 'customers' ? <>
          <Text style={styles.customerNote}>Known customers from matched history · highest quantity first</Text>
          {selectedCustomers.map((customer) => <View key={customer.id} style={styles.customerCard}>
            <View style={styles.customerHeader}>
              <View style={styles.customerCopy}><Text style={styles.customerName}>{customer.name}</Text>{customer.location ? <Text style={styles.customerLocation}>{customer.location}</Text> : null}</View>
              <View style={styles.customerTotal}><Text style={styles.customerTotalValue}>{customer.total}</Text><Text style={styles.customerTotalUnit}>CRATES</Text></View>
            </View>
            {customer.items.map((item, index) => <View key={item.id} style={[styles.customerItem, index === customer.items.length - 1 && styles.customerItemLast]}>
              <Text style={styles.customerItemName}>{item.variant_name}</Text>
              <Text style={styles.customerItemRange}>{item.low_crates}–{item.high_crates} usual</Text>
              <Text style={styles.customerItemQty}>{item.recommended_crates} cr</Text>
            </View>)}
          </View>)}
          {!selectedCustomers.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>No known customer demand</Text><Text style={styles.emptyText}>Item demand may still include unmatched historical customers.</Text></View> : null}
        </> : null}
        {!forecast.loading && view === 'accuracy' ? <>
          {accuracySummary.accuracy !== null ? <View style={styles.accuracySummary}>
            <Text style={styles.accuracyEyebrow}>FORECAST VS ACTUAL</Text>
            <Text style={styles.accuracyValue}>{Math.round(accuracySummary.accuracy * 100)}%</Text>
            <Text style={styles.accuracyCaption}>plan accuracy across {forecast.accuracyRows.length} completed item forecasts</Text>
          </View> : <View style={styles.empty}><Text style={styles.emptyTitle}>Accuracy starts after the forecast date</Text><Text style={styles.emptyText}>Once actual sales are recorded, this tab will compare them with both the system recommendation and your approved plan.</Text></View>}
          {forecast.accuracyRows.map((row) => <View key={row.recommendation_id} style={styles.actualRow}>
            <View style={styles.actualCopy}><Text style={styles.actualName}>{row.variant_name}</Text><Text style={styles.actualDate}>{formatBusinessDate(row.forecast_date)}</Text></View>
            <View style={styles.actualMetric}><Text style={styles.actualMetricLabel}>PLAN</Text><Text style={styles.actualMetricValue}>{row.final_crates}</Text></View>
            <View style={styles.actualMetric}><Text style={styles.actualMetricLabel}>ACTUAL</Text><Text style={styles.actualMetricValue}>{row.actual_crates}</Text></View>
            <View style={styles.actualPercent}><Text style={styles.actualPercentText}>{Math.round(row.plan_accuracy * 100)}%</Text></View>
          </View>)}
        </> : null}
      </ScrollView>

      {forecast.hasChanges ? <View style={styles.saveBar}><Text style={styles.saveHint}>Unsaved planning changes</Text><TouchableOpacity disabled={forecast.saving} style={styles.saveButton} onPress={() => void forecast.save()}><Text style={styles.saveButtonText}>{forecast.saving ? 'Saving…' : 'Save plan'}</Text></TouchableOpacity></View> : null}
    </View>
  );
}
