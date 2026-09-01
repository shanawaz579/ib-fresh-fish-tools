import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { FishVariety } from '../../types';
import styles from '../../styles/SalesScreen.styles';

type Props = {
  varieties: FishVariety[];
  getStock: (id: number) => { available: { crates: number; kg: number } };
  onSelect: (id: number) => void;
};

export default function AvailableStockStrip({ varieties, getStock, onSelect }: Props) {
  const available = varieties.filter((variant) => {
    const stock = getStock(variant.id).available;
    return stock.crates > 0 || stock.kg > 0;
  });

  return (
    <View style={styles.compactStockSection}>
      <View style={styles.compactStockHeader}>
        <Text style={styles.compactStockTitle}>Available stock</Text>
        <Text style={styles.compactStockHint}>Tap an item to sell</Text>
      </View>
      {available.length === 0 ? <Text style={styles.emptyStock}>No stock available as of this date</Text> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stockChipRow}>
          {available.map((variant) => {
            const stock = getStock(variant.id).available;
            return (
              <TouchableOpacity key={variant.id} style={styles.stockChip} onPress={() => onSelect(variant.id)}>
                <Text style={styles.stockChipName} numberOfLines={1}>{variant.name}</Text>
                <Text style={styles.stockChipQty}>{[stock.crates > 0 ? `${stock.crates} cr` : '', stock.kg > 0 ? `${stock.kg} kg` : ''].filter(Boolean).join(' · ')}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
