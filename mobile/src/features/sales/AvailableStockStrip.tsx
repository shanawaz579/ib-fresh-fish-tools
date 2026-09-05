import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { FishVariety } from '../../types';
import styles from '../../styles/SalesScreen.styles';

type Props = {
  varieties: FishVariety[];
  getStock: (id: number) => {
    purchased: { crates: number; kg: number };
    available: { crates: number; kg: number };
  };
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
      };
    })
    .filter(({ stock }) => stock.crates > 0 || stock.kg > 0)
    .sort((a, b) => b.stock.crates - a.stock.crates || b.stock.kg - a.stock.kg || a.variant.name.localeCompare(b.variant.name));
  const collapsedItemCount = 6;
  const visible = expanded ? available : available.slice(0, collapsedItemCount);
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
            {row.map(({ variant, stock }) => {
              const totals = getStock(variant.id).purchased;
              return (
                <TouchableOpacity key={variant.id} style={styles.stockChip} onPress={() => onSelect(variant.id)}>
                  <Text style={styles.stockChipName} numberOfLines={1}>{variant.name}</Text>
                  <View style={styles.stockChipMetrics}>
                    <Text style={styles.stockChipQty}>{[
                      totals.crates > 0 ? `${stock.crates}/${totals.crates} cr` : '',
                      totals.kg > 0 ? `${stock.kg}/${totals.kg} kg` : '',
                    ].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {row.length === 1 ? <View style={styles.stockChipSpacer} /> : null}
          </View>
        ))}</View>
      )}
      {available.length > collapsedItemCount ? (
        <TouchableOpacity style={styles.stockMoreButton} onPress={() => setExpanded(current => !current)}>
          <Text style={styles.stockMoreText}>{expanded ? 'Show less' : `More items (${available.length - collapsedItemCount})`}</Text>
          <Text style={styles.stockMoreIcon}>{expanded ? '↑' : '↓'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
