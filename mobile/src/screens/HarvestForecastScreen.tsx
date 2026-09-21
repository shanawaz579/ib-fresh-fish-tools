import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  useEffect(() => { setSelectedDate(forecast.startDate); }, [forecast.startDate]);
  const selectedRows = forecast.rows.filter((row) => row.forecast_date === selectedDate);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(forecast.drafts[row.id] || 0), 0);

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
          <TouchableOpacity disabled={forecast.loading} style={styles.refreshButton} onPress={() => void forecast.refresh()}><Text style={styles.refreshText}>Refresh</Text></TouchableOpacity>
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
        {forecast.loading ? <View style={styles.loading}><ActivityIndicator color="#0F766E" size="large" /><Text style={styles.loadingText}>Preparing recommendations…</Text></View> : null}
        {!forecast.loading && forecast.rows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No crate demand found</Text><Text style={styles.emptyText}>There is not enough matched history for this week yet.</Text></View> : null}

        {!forecast.loading && selectedRows.length ? (
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
                      <Text style={styles.range}>usual {row.low_crates}–{row.high_crates} cr</Text>
                    </View>
                  </View>
                  <View style={styles.quantityBox}>
                    <TextInput
                      style={[styles.quantityInput, row.is_overridden && styles.quantityInputChanged]}
                      value={forecast.drafts[row.id] ?? ''}
                      onChangeText={(value) => forecast.updateDraft(row.id, value)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      maxLength={4}
                    />
                    <Text style={styles.quantityUnit}>cr</Text>
                  </View>
                </View>
              ))}
            </View>
        ) : null}
      </ScrollView>

      {forecast.hasChanges ? <View style={styles.saveBar}><Text style={styles.saveHint}>Unsaved planning changes</Text><TouchableOpacity disabled={forecast.saving} style={styles.saveButton} onPress={() => void forecast.save()}><Text style={styles.saveButtonText}>{forecast.saving ? 'Saving…' : 'Save plan'}</Text></TouchableOpacity></View> : null}
    </View>
  );
}
