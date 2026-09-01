import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import StockAdjustmentModal from '../features/stock/StockAdjustmentModal';
import { getFishVarieties, getStockMovements, getStockSnapshot, voidStockAdjustment } from '../api/stock';
import { formatStockDelta, formatStockQuantity, getMovementLabel, type StockMovement, type StockSnapshot } from '../domain/stockLedger';
import { useBusinessDate } from '../hooks/useBusinessDate';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { FishVariety } from '../types';
import styles from '../styles/StockLedgerScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'StockLedger'>;
type ViewMode = 'snapshot' | 'movements';

export default function StockLedgerScreen({ navigation }: Props) {
  const { date, goToPreviousDay, goToNextDay, goToToday } = useBusinessDate();
  const [snapshots, setSnapshots] = useState<StockSnapshot[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('snapshot');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>();
  const [movementToVoid, setMovementToVoid] = useState<StockMovement | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const load = async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [snapshotData, movementData, varietyData] = await Promise.all([
        getStockSnapshot(date),
        getStockMovements(date),
        getFishVarieties(),
      ]);
      setSnapshots(snapshotData);
      setMovements(movementData);
      setVarieties(varietyData);
    } catch (error) {
      console.error('Unable to load stock ledger:', error);
      Alert.alert('Unable to load stock', 'Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [date]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleSnapshots = useMemo(() => snapshots.filter((item) =>
    !normalizedQuery || item.variantName.toLowerCase().includes(normalizedQuery),
  ), [normalizedQuery, snapshots]);
  const visibleMovements = useMemo(() => movements.filter((item) =>
    !normalizedQuery || `${item.variantName} ${item.reason ?? ''} ${getMovementLabel(item.movementType)}`.toLowerCase().includes(normalizedQuery),
  ), [movements, normalizedQuery]);

  const totals = useMemo(() => snapshots.reduce((sum, item) => ({
    openingCrates: sum.openingCrates + item.openingCrates,
    openingKg: sum.openingKg + item.openingKg,
    inwardCrates: sum.inwardCrates + item.inwardCrates,
    inwardKg: sum.inwardKg + item.inwardKg,
    outwardCrates: sum.outwardCrates + item.outwardCrates,
    outwardKg: sum.outwardKg + item.outwardKg,
    closingCrates: sum.closingCrates + item.closingCrates,
    closingKg: sum.closingKg + item.closingKg,
  }), { openingCrates: 0, openingKg: 0, inwardCrates: 0, inwardKg: 0, outwardCrates: 0, outwardKg: 0, closingCrates: 0, closingKg: 0 }), [snapshots]);

  const openAdjustment = (variantId?: number) => {
    setSelectedVariantId(variantId);
    setShowAdjustment(true);
  };

  const voidMovement = async () => {
    if (!movementToVoid || !voidReason.trim()) {
      Alert.alert('Reason required', 'Enter why this adjustment is being voided.');
      return;
    }
    setVoiding(true);
    try {
      await voidStockAdjustment(movementToVoid.id, voidReason);
      setMovementToVoid(null);
      setVoidReason('');
      await load(true);
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Unable to void adjustment';
      Alert.alert('Stock was not changed', message);
    } finally {
      setVoiding(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>Stock Ledger</Text><Text style={styles.headerSubtitle}>Cumulative, auditable inventory</Text></View>
        <TouchableOpacity style={styles.adjustButton} onPress={() => openAdjustment()}><Text style={styles.adjustButtonText}>Adjust</Text></TouchableOpacity>
      </View>

      <DateNavigator date={date} onPrevious={goToPreviousDay} onNext={goToNextDay} onToday={goToToday} accentColor="#0F766E" />

      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Opening</Text><Text style={styles.summaryValue}>{formatStockQuantity(totals.openingCrates, totals.openingKg)}</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Inward</Text><Text style={styles.inwardValue}>+{formatStockQuantity(totals.inwardCrates, totals.inwardKg)}</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryLabel}>Outward</Text><Text style={styles.outwardValue}>−{formatStockQuantity(totals.outwardCrates, totals.outwardKg)}</Text></View>
        <View style={[styles.summaryItem, styles.closingSummary]}><Text style={styles.summaryLabel}>Closing</Text><Text style={styles.closingValue}>{formatStockQuantity(totals.closingCrates, totals.closingKg)}</Text></View>
      </View>

      <View style={styles.toolbar}>
        <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search item or movement" />
        <View style={styles.viewToggle}>
          <TouchableOpacity style={[styles.toggleButton, viewMode === 'snapshot' && styles.toggleButtonActive]} onPress={() => setViewMode('snapshot')}><Text style={[styles.toggleText, viewMode === 'snapshot' && styles.toggleTextActive]}>Stock</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.toggleButton, viewMode === 'movements' && styles.toggleButtonActive]} onPress={() => setViewMode('movements')}><Text style={[styles.toggleText, viewMode === 'movements' && styles.toggleTextActive]}>Movements</Text></TouchableOpacity>
        </View>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#0F766E" /></View> : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
          {viewMode === 'snapshot' ? (
            visibleSnapshots.length === 0 ? <Text style={styles.emptyText}>No stock activity for this date.</Text> : visibleSnapshots.map((item) => {
              const low = item.closingCrates <= 5 && item.closingKg <= 50;
              return (
                <TouchableOpacity key={item.itemVariantId} style={styles.stockCard} onPress={() => openAdjustment(item.itemVariantId)}>
                  <View style={styles.stockCardHeader}>
                    <View style={styles.stockIdentity}><Text style={styles.stockName}>{item.variantName}</Text><Text style={[styles.stockStatus, low && styles.lowStock]}>{item.closingCrates === 0 && item.closingKg === 0 ? 'Out of stock' : low ? 'Low stock' : 'Available'}</Text></View>
                    <View style={styles.closingWrap}><Text style={styles.closingLabel}>Closing</Text><Text style={styles.stockClosing}>{formatStockQuantity(item.closingCrates, item.closingKg)}</Text></View>
                  </View>
                  <View style={styles.stockFlowRow}>
                    <Text style={styles.flowText}>Open {formatStockQuantity(item.openingCrates, item.openingKg)}</Text>
                    <Text style={styles.flowIn}>+ {formatStockQuantity(item.inwardCrates, item.inwardKg)}</Text>
                    <Text style={styles.flowOut}>− {formatStockQuantity(item.outwardCrates, item.outwardKg)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            visibleMovements.length === 0 ? <Text style={styles.emptyText}>No movements for this date.</Text> : visibleMovements.map((movement) => {
              const positive = movement.cratesDelta > 0 || movement.kgDelta > 0;
              const negative = movement.cratesDelta < 0 || movement.kgDelta < 0;
              const mixed = positive && negative;
              return (
                <View key={movement.id} style={[styles.movementCard, movement.voidedAt && styles.voidedCard]}>
                  <View style={styles.movementMain}>
                    <Text style={styles.movementName}>{movement.variantName}</Text>
                    <Text style={styles.movementMeta}>{getMovementLabel(movement.movementType)}{movement.reason ? ` · ${movement.reason}` : ''}</Text>
                    {movement.voidReason ? <Text style={styles.voidReason}>Void: {movement.voidReason}</Text> : null}
                  </View>
                  <View style={styles.movementRight}>
                    <Text style={[styles.movementQty, mixed ? styles.mixedQty : positive ? styles.positiveQty : styles.negativeQty, movement.voidedAt && styles.voidedQty]}>{formatStockDelta(movement.cratesDelta, movement.kgDelta)}</Text>
                    {movement.sourceType === 'manual' && !movement.voidedAt ? <TouchableOpacity onPress={() => { setMovementToVoid(movement); setVoidReason(''); }}><Text style={styles.voidLink}>Void</Text></TouchableOpacity> : null}
                    {movement.voidedAt ? <Text style={styles.voidedBadge}>VOIDED</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <StockAdjustmentModal visible={showAdjustment} date={date} varieties={varieties} snapshots={snapshots} initialVariantId={selectedVariantId} onClose={() => setShowAdjustment(false)} onSaved={() => load(true)} />

      <Modal visible={movementToVoid !== null} transparent animationType="fade" onRequestClose={() => setMovementToVoid(null)}>
        <View style={styles.centerOverlay}><View style={styles.voidDialog}>
          <Text style={styles.dialogTitle}>Void stock adjustment?</Text>
          <Text style={styles.dialogHelp}>The original record stays in the audit trail. Its stock effect will be reversed.</Text>
          <TextInput style={[styles.input, styles.voidInput]} value={voidReason} onChangeText={setVoidReason} placeholder="Reason for voiding" multiline />
          <View style={styles.dialogActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setMovementToVoid(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.confirmVoidButton} onPress={voidMovement} disabled={voiding}>{voiding ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmVoidText}>Void adjustment</Text>}</TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}
