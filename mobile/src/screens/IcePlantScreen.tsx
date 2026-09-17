import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import { getIceGridDetail, setIceCanOverride, setIceRowStatus, setIceSampleColumn, verifyIceRowGrid, type IceCanStatus, type IceGridCell } from '../api/icePlant';
import { useBusinessDate } from '../hooks/useBusinessDate';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { toLocalDateString } from '../utils/date';
import styles from '../styles/IcePlantScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'IcePlant'>;
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const SAMPLE_COLUMNS = COLUMNS.slice(0, 12);
const ROW_NUMBERS = Array.from({ length: 19 }, (_, index) => index + 1);
const STATUS_OPTIONS: Array<{ value: IceCanStatus; short: string; label: string; color: string; background: string }> = [
  { value: 'water', short: 'W', label: 'Water', color: '#0369A1', background: '#E0F2FE' },
  { value: 'quarter', short: '¼', label: 'Quarter', color: '#0E7490', background: '#CFFAFE' },
  { value: 'half', short: '½', label: 'Half', color: '#A16207', background: '#FEF3C7' },
  { value: 'three_quarter', short: '¾', label: '3/4', color: '#C2410C', background: '#FFEDD5' },
  { value: 'full', short: 'F', label: 'Full', color: '#047857', background: '#D1FAE5' },
];
const STATUS_META = Object.fromEntries(STATUS_OPTIONS.map(option => [option.value, option])) as Record<IceCanStatus, typeof STATUS_OPTIONS[number]>;
const errorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again.';

export default function IcePlantScreen({ navigation }: Props) {
  const { date, goToPreviousDay, goToNextDay, goToToday } = useBusinessDate();
  const [cells, setCells] = useState<IceGridCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRows, setSavingRows] = useState<Set<number>>(new Set());
  const [savingCans, setSavingCans] = useState<Set<number>>(new Set());
  const [changingColumn, setChangingColumn] = useState(false);
  const [showColumnOptions, setShowColumnOptions] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [statusTarget, setStatusTarget] = useState<IceGridCell | null>(null);
  const suppressPressRef = useRef(false);

  const loadGrid = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try { setCells(await getIceGridDetail(date)); }
    catch (error) { Alert.alert('Unable to load Ice Plant check', errorMessage(error)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [date]);
  useEffect(() => { void loadGrid(); }, [loadGrid]);

  const sampleColumn = cells[0]?.sample_column ?? 'A';
  const cellMap = useMemo(() => new Map(cells.map(cell => [`${cell.column_code}${cell.row_number}`, cell])), [cells]);
  const counts = useMemo(() => cells.filter(cell => cell.is_active).reduce((result, cell) => {
    result[cell.effective_status] += 1;
    if (cell.column_code === cell.sample_column && cell.row_verified) result.verifiedRows += 1;
    return result;
  }, { water: 0, quarter: 0, half: 0, three_quarter: 0, full: 0, verifiedRows: 0 }), [cells]);
  const exceptionCount = useMemo(() => cells.filter(cell => cell.is_active && cell.is_override).length, [cells]);

  const changeSampleColumn = async (column: string) => {
    if (changingColumn || column === sampleColumn) return;
    setChangingColumn(true);
    try {
      await setIceSampleColumn(date, column);
      await loadGrid(true);
      setShowColumnOptions(false);
    }
    catch (error) {
      Alert.alert('Column not changed', errorMessage(error));
    } finally { setChangingColumn(false); }
  };

  const applyRowStatus = async (rowNumber: number, nextStatus: IceCanStatus) => {
    if (savingRows.has(rowNumber)) return;
    const previousRow = new Map(cells.filter(cell => cell.row_number === rowNumber).map(cell => [cell.can_id, cell]));
    setCells(current => current.map(cell => cell.row_number === rowNumber ? { ...cell, row_status: nextStatus, effective_status: nextStatus, row_verified: true, is_override: false, checked_at: new Date().toISOString() } : cell));
    setSavingRows(current => new Set(current).add(rowNumber));
    try { await setIceRowStatus(rowNumber, date, nextStatus); }
    catch (error) {
      setCells(current => current.map(cell => previousRow.get(cell.can_id) ?? cell));
      Alert.alert('Row status not saved', errorMessage(error));
    } finally {
      setSavingRows(current => { const next = new Set(current); next.delete(rowNumber); return next; });
    }
  };

  const cycleRowStatus = (rowNumber: number, currentStatus: IceCanStatus) => {
    const index = STATUS_OPTIONS.findIndex(option => option.value === currentStatus);
    void applyRowStatus(rowNumber, STATUS_OPTIONS[(index + 1) % STATUS_OPTIONS.length].value);
  };

  const applyCanStatus = async (cell: IceGridCell, nextStatus: IceCanStatus) => {
    if (savingRows.has(cell.row_number) || savingCans.has(cell.can_id)) return;
    const previous = cell;
    setCells(current => current.map(item => item.can_id === cell.can_id ? { ...item, effective_status: nextStatus, is_override: nextStatus !== item.row_status, checked_at: new Date().toISOString() } : item));
    setSavingCans(current => new Set(current).add(cell.can_id));
    try { await setIceCanOverride(cell.can_id, date, nextStatus); }
    catch (error) {
      setCells(current => current.map(item => item.can_id === cell.can_id ? previous : item));
      Alert.alert('Can status not saved', errorMessage(error));
    } finally {
      setSavingCans(current => { const next = new Set(current); next.delete(cell.can_id); return next; });
    }
  };

  const cycleCanStatus = (cell: IceGridCell) => {
    const index = STATUS_OPTIONS.findIndex(option => option.value === cell.effective_status);
    void applyCanStatus(cell, STATUS_OPTIONS[(index + 1) % STATUS_OPTIONS.length].value);
  };

  const openStatusPicker = (cell: IceGridCell) => {
    suppressPressRef.current = true;
    setStatusTarget(cell);
    setTimeout(() => { suppressPressRef.current = false; }, 500);
  };

  const handleCellPress = (cell: IceGridCell, sample: boolean) => {
    if (statusTarget || suppressPressRef.current) return;
    sample ? cycleRowStatus(cell.row_number, cell.row_status) : cycleCanStatus(cell);
  };

  const chooseStatus = (status: IceCanStatus) => {
    const target = statusTarget;
    if (!target) return;
    setStatusTarget(null);
    if (target.column_code === target.sample_column) void applyRowStatus(target.row_number, status);
    else void applyCanStatus(target, status);
  };

  const verifyRemaining = async () => {
    setVerifying(true);
    try { await verifyIceRowGrid(date); await loadGrid(true); }
    catch (error) { Alert.alert('Unable to verify rows', errorMessage(error)); }
    finally { setVerifying(false); }
  };
  const confirmRemaining = () => {
    const message = `Confirm the carried status for the remaining ${ROW_NUMBERS.length - counts.verifiedRows} rows?`;
    if (Platform.OS === 'web') { if (window.confirm(message)) void verifyRemaining(); return; }
    Alert.alert('Verify unchanged rows?', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Verify', onPress: () => { void verifyRemaining(); } }]);
  };

  return <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityLabel="Go back" style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backText}>‹</Text></TouchableOpacity>
      <View><Text style={styles.eyebrow}>INDEPENDENT DAILY CHECK</Text><Text style={styles.title}>Ice Plant</Text></View>
      <TouchableOpacity accessibilityLabel="Open Ice Plant money" style={styles.moneyButton} onPress={() => navigation.navigate('IceFinance')}><Text style={styles.moneyButtonText}>₹ Money</Text></TouchableOpacity>
    </View>
    <DateNavigator date={date} onPrevious={goToPreviousDay} onNext={goToNextDay} onToday={goToToday} canGoNext={date < toLocalDateString()} accentColor="#0891B2" />
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadGrid(true); }} colors={['#0891B2']} />}>
      <View style={styles.summaryCard}>
        <View style={styles.primarySummary}><Text style={styles.primaryValue}>{counts.full}</Text><Text style={styles.primaryLabel}>EST. READY</Text></View>
        <View style={styles.summaryDivider} />
        <View style={styles.stageSummary}>
          <View style={styles.stageMetric}><Text style={styles.stageSymbol}>¼</Text><Text style={styles.stageValue}>{counts.quarter}</Text></View>
          <View style={styles.stageMetric}><Text style={styles.stageSymbol}>½</Text><Text style={styles.stageValue}>{counts.half}</Text></View>
          <View style={styles.stageMetric}><Text style={styles.stageSymbol}>¾</Text><Text style={styles.stageValue}>{counts.three_quarter}</Text></View>
          <Text style={styles.stageLabel}>FREEZING STAGES</Text>
        </View>
        <View style={styles.summaryMetric}><Text style={styles.metricValue}>{counts.water}</Text><Text style={styles.metricLabel}>WATER</Text></View>
        <View style={styles.summaryMetric}><Text style={styles.metricValue}>{counts.verifiedRows}/19</Text><Text style={styles.metricLabel}>ROWS CHECKED</Text></View>
      </View>
      {exceptionCount > 0 ? <View style={styles.exceptionSummary}><View style={styles.exceptionSummaryDot} /><Text style={styles.exceptionSummaryText}>{exceptionCount} individual {exceptionCount === 1 ? 'exception' : 'exceptions'}</Text></View> : null}
      <View style={styles.sampleCard}>
        <View style={styles.sampleHeader}>
          <View style={styles.sampleTitleRow}><Text style={styles.sampleEyebrow}>TODAY'S CHECK</Text><Text style={styles.sampleTitle}>Column {sampleColumn}</Text></View>
          <TouchableOpacity accessibilityLabel="Change sample column" style={styles.changeColumnButton} onPress={() => setShowColumnOptions(current => !current)}>
            <Text style={styles.changeColumnText}>{showColumnOptions ? 'Done' : 'Change'}</Text>
          </TouchableOpacity>
        </View>
        {showColumnOptions ? <View style={styles.columnPicker}>{SAMPLE_COLUMNS.map(column => <TouchableOpacity accessibilityLabel={`Use column ${column}`} disabled={changingColumn} key={column} onPress={() => { void changeSampleColumn(column); }} style={[styles.columnButton, column === sampleColumn && styles.columnButtonSelected]}><Text style={[styles.columnButtonText, column === sampleColumn && styles.columnButtonTextSelected]}>{column}</Text></TouchableOpacity>)}</View> : null}
      </View>
      <Text style={styles.instruction}>Highlighted cell changes its row. Tap to cycle · hold any cell to choose a stage.</Text>
      <View style={styles.legend}>{STATUS_OPTIONS.map(option => <View key={option.value} style={styles.legendItem}><View style={[styles.legendBadge, { backgroundColor: option.background }]}><Text style={[styles.legendShort, { color: option.color }]}>{option.short}</Text></View><Text style={styles.legendLabel}>{option.label}</Text></View>)}</View>
      <View style={styles.gridCard}>
        <View style={styles.gridHeader}><View style={styles.rowLabel} />{COLUMNS.map(column => <Text key={column} style={[styles.columnLabel, column === sampleColumn ? styles.sampleColumnLabel : styles.regularColumn]}>{column}</Text>)}</View>
        {loading ? <View style={styles.loading}><ActivityIndicator color="#0891B2" /><Text style={styles.loadingText}>Preparing daily sample…</Text></View> : ROW_NUMBERS.map(rowNumber => {
          const sampleRowCell = cellMap.get(`${sampleColumn}${rowNumber}`);
          if (!sampleRowCell) return null;
          return <View key={rowNumber} style={styles.gridRow}><View style={styles.rowLabel}><Text style={styles.rowNumber}>{rowNumber}</Text>{sampleRowCell.row_verified ? <Text style={styles.rowChecked}>✓</Text> : null}</View>{COLUMNS.map(column => {
            const cell = cellMap.get(`${column}${rowNumber}`);
            if (!cell || !cell.is_active) return <View key={column} style={[styles.cell, styles.regularCell, styles.removedCell]}><Text style={styles.removedText}>×</Text></View>;
            const sample = column === sampleColumn;
            const meta = STATUS_META[cell.effective_status];
            const saving = savingRows.has(rowNumber) || savingCans.has(cell.can_id);
            const cellStyle = [styles.cell, sample ? styles.sampleCell : styles.regularCell, { backgroundColor: meta.background, borderColor: meta.color }, !cell.row_verified && styles.carriedCell, sample && !cell.row_verified && styles.uncheckedSampleCell, cell.is_override && styles.overrideCell, saving && styles.savingCell];
            return <TouchableOpacity accessibilityLabel={`${cell.label}, ${meta.label}${sample ? ', changes complete row' : cell.is_override ? ', individual exception' : ', tap for individual change'}`} delayLongPress={350} disabled={saving} key={column} onLongPress={() => openStatusPicker(cell)} onPress={() => handleCellPress(cell, sample)} style={cellStyle}>
              <Text style={[styles.cellText, { color: meta.color }]}>{meta.short}</Text>{cell.is_override ? <View style={styles.overrideDot} /> : null}
            </TouchableOpacity>;
          })}</View>;
        })}
      </View>
      <View style={styles.gridNote}><View style={styles.highlightSample} /><Text style={styles.gridNoteText}>Light cells are carried forward. Highlighted cells update the full row; other cells create individual exceptions. M19 is removed.</Text></View>
      <View style={styles.exceptionLegend}><View style={styles.exceptionLegendDot} /><Text style={styles.exceptionLegendText}>Purple dot and border = individual can differs from its row.</Text></View>
      {!loading && counts.verifiedRows < ROW_NUMBERS.length ? <TouchableOpacity disabled={verifying} style={styles.verifyButton} onPress={confirmRemaining}>{verifying ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.verifyButtonText}>Verify remaining rows as unchanged</Text>}</TouchableOpacity> : !loading ? <View style={styles.completeCard}><Text style={styles.completeText}>✓ Daily check complete · 19/19 rows</Text></View> : null}
    </ScrollView>
    <Modal animationType="fade" onRequestClose={() => setStatusTarget(null)} transparent visible={statusTarget !== null}>
      <TouchableOpacity activeOpacity={1} accessibilityLabel="Close status choices" onPress={() => setStatusTarget(null)} style={styles.modalOverlay}>
        <TouchableOpacity activeOpacity={1} onPress={() => undefined} style={styles.statusPicker}>
          <Text style={styles.statusPickerEyebrow}>{statusTarget?.column_code === statusTarget?.sample_column ? 'UPDATE COMPLETE ROW' : 'UPDATE THIS CAN ONLY'}</Text>
          <Text style={styles.statusPickerTitle}>{statusTarget?.label}</Text>
          <View style={styles.statusOptions}>
            {STATUS_OPTIONS.map(option => {
              const selected = statusTarget?.effective_status === option.value;
              return <TouchableOpacity accessibilityLabel={`Choose ${option.label}`} key={option.value} onPress={() => chooseStatus(option.value)} style={[styles.statusOption, selected && styles.statusOptionSelected]}>
                <View style={[styles.statusOptionBadge, { backgroundColor: option.background }]}><Text style={[styles.statusOptionShort, { color: option.color }]}>{option.short}</Text></View>
                <Text style={styles.statusOptionLabel}>{option.label}</Text>
                {selected ? <Text style={styles.statusOptionCheck}>✓</Text> : null}
              </TouchableOpacity>;
            })}
          </View>
          <TouchableOpacity onPress={() => setStatusTarget(null)} style={styles.statusCancel}><Text style={styles.statusCancelText}>Cancel</Text></TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  </View>;
}
