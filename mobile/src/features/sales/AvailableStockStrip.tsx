import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { normalizeCratesAndKg } from '../../domain/fish';
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
  const hasVisibleApproximation = visible.some(({ variant, stock }) => {
    const totals = getStock(variant.id).purchased;
    const normalizedStock = normalizeCratesAndKg(stock.crates, stock.kg, variant.default_kg_per_crate);
    const normalizedTotals = normalizeCratesAndKg(totals.crates, totals.kg, variant.default_kg_per_crate);
    return normalizedStock.crates !== stock.crates || normalizedTotals.crates !== totals.crates;
  });

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
              const crateWeight = variant.default_kg_per_crate;
              const normalizedStock = normalizeCratesAndKg(stock.crates, stock.kg, crateWeight);
              const normalizedTotals = normalizeCratesAndKg(totals.crates, totals.kg, crateWeight);
              const isApproximate = normalizedStock.crates !== stock.crates
                || normalizedTotals.crates !== totals.crates;
              return (
                <TouchableOpacity key={variant.id} style={styles.stockChip} onPress={() => onSelect(variant.id)}>
                  <Text style={styles.stockChipName} numberOfLines={1}>{variant.name}</Text>
                  <View style={styles.stockChipMetrics}>
                    <Text style={styles.stockChipQty}>{isApproximate ? '≈ ' : ''}{[
                      normalizedStock.crates > 0 || normalizedTotals.crates > 0
                        ? `${normalizedStock.crates}/${normalizedTotals.crates} cr`
                        : '',
                      normalizedStock.kg > 0 || normalizedTotals.kg > 0
                        ? `${normalizedStock.kg}/${normalizedTotals.kg} kg`
                        : '',
                    ].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {row.length === 1 ? <View style={styles.stockChipSpacer} /> : null}
          </View>
        ))}</View>
      )}
      {hasVisibleApproximation ? (
        <Text style={styles.stockApproximationNote}>≈ Crate equivalent using the item’s kg/crate setting</Text>
      ) : null}
      {available.length > collapsedItemCount ? (
        <TouchableOpacity style={styles.stockMoreButton} onPress={() => setExpanded(current => !current)}>
          <Text style={styles.stockMoreText}>{expanded ? 'Show less' : `More items (${available.length - collapsedItemCount})`}</Text>
          <Text style={styles.stockMoreIcon}>{expanded ? '↑' : '↓'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
