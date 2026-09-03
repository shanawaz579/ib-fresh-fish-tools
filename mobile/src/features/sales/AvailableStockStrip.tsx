import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { getTotalWeightKg } from '../../domain/fish';
import type { FishVariety } from '../../types';
import styles from '../../styles/SalesScreen.styles';

type Props = {
  varieties: FishVariety[];
  getStock: (id: number) => { available: { crates: number; kg: number } };
  onSelect: (id: number) => void;
};

export default function AvailableStockStrip({ varieties, getStock, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const available = varieties
    .map((variant) => {
      const stock = getStock(variant.id).available;
      return {
        variant,
        stock,
        totalWeightKg: getTotalWeightKg(
          stock.crates,
          stock.kg,
          variant.default_kg_per_crate,
        ),
      };
    })
    .filter(({ stock }) => stock.crates > 0 || stock.kg > 0)
    .sort((a, b) => b.totalWeightKg - a.totalWeightKg || a.variant.name.localeCompare(b.variant.name));
  const visible = expanded ? available : available.slice(0, 5);
  const rows = Array.from({ length: Math.ceil(visible.length / 2) }, (_, index) => visible.slice(index * 2, index * 2 + 2));

  return (
    <View style={styles.compactStockSection}>
      <View style={styles.compactStockHeader}>
        <Text style={styles.compactStockTitle}>Available stock</Text>
        <Text style={styles.compactStockHint}>Tap an item to sell</Text>
      </View>
      {available.length === 0 ? <Text style={styles.emptyStock}>No stock available as of this date</Text> : (
        <View style={styles.stockGrid}>{rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.stockGridRow}>
            {row.map(({ variant, stock, totalWeightKg }) => {
              return (
                <TouchableOpacity key={variant.id} style={styles.stockChip} onPress={() => onSelect(variant.id)}>
                  <Text style={styles.stockChipName} numberOfLines={1}>{variant.name}</Text>
                  <View style={styles.stockChipMetrics}>
                    <Text style={styles.stockChipTotal}>{totalWeightKg.toLocaleString()} kg</Text>
                    <Text style={styles.stockChipQty}>{[stock.crates > 0 ? `${stock.crates} cr` : '', stock.kg > 0 ? `${stock.kg} kg` : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {row.length === 1 ? <View style={styles.stockChipSpacer} /> : null}
          </View>
        ))}</View>
      )}
      {available.length > 5 ? (
        <TouchableOpacity style={styles.stockMoreButton} onPress={() => setExpanded(current => !current)}>
          <Text style={styles.stockMoreText}>{expanded ? 'Show less' : `More items (${available.length - 5})`}</Text>
          <Text style={styles.stockMoreIcon}>{expanded ? '↑' : '↓'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
