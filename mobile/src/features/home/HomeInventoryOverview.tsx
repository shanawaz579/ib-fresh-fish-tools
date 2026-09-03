import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getStockSnapshot } from '../../api/stock';
import { formatStockQuantity, type StockSnapshot } from '../../domain/stockLedger';
import { toLocalDateString } from '../../utils/date';
import styles from '../../styles/HomeScreen.styles';

type Props = { onPress: () => void };

export default function HomeInventoryOverview({ onPress }: Props) {
  const [stock, setStock] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setStock(await getStockSnapshot(toLocalDateString()));
    } catch (error) {
      console.warn('Unable to load home inventory overview:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const totals = useMemo(() => stock.reduce((sum, row) => ({
    closingCrates: sum.closingCrates + row.closingCrates,
    closingKg: sum.closingKg + row.closingKg,
    inwardCrates: sum.inwardCrates + row.inwardCrates,
    inwardKg: sum.inwardKg + row.inwardKg,
    outwardCrates: sum.outwardCrates + row.outwardCrates,
    outwardKg: sum.outwardKg + row.outwardKg,
    activeItems: sum.activeItems + (row.closingCrates !== 0 || row.closingKg !== 0 ? 1 : 0),
  }), {
    closingCrates: 0,
    closingKg: 0,
    inwardCrates: 0,
    inwardKg: 0,
    outwardCrates: 0,
    outwardKg: 0,
    activeItems: 0,
  }), [stock]);

  return (
    <TouchableOpacity style={styles.inventoryCard} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.inventoryHeader}>
        <View>
          <Text style={styles.inventoryEyebrow}>PROPRIETOR VIEW · TODAY</Text>
          <Text style={styles.inventoryTitle}>Inventory overview</Text>
        </View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
      </View>

      {loading ? <View style={styles.inventoryLoading}><ActivityIndicator color="#FFFFFF" /></View> : <>
        <Text style={styles.inventoryQuantity}>{formatStockQuantity(totals.closingCrates, totals.closingKg)}</Text>
        <Text style={styles.inventoryQuantityLabel}>Available closing stock</Text>
        <View style={styles.inventoryMetrics}>
          <View style={styles.inventoryMetric}>
            <Text style={styles.metricLabel}>INWARD</Text>
            <Text style={styles.metricValue}>+{formatStockQuantity(totals.inwardCrates, totals.inwardKg)}</Text>
          </View>
          <View style={[styles.inventoryMetric, styles.metricDivider]}>
            <Text style={styles.metricLabel}>OUTWARD</Text>
            <Text style={styles.metricValue}>−{formatStockQuantity(totals.outwardCrates, totals.outwardKg)}</Text>
          </View>
          <View style={[styles.inventoryMetric, styles.metricDivider]}>
            <Text style={styles.metricLabel}>ITEMS</Text>
            <Text style={styles.metricValue}>{totals.activeItems}</Text>
          </View>
        </View>
      </>}

      <View style={styles.inventoryFooter}><Text style={styles.inventoryFooterText}>Open simple stock dashboard</Text><Text style={styles.inventoryArrow}>›</Text></View>
    </TouchableOpacity>
  );
}
