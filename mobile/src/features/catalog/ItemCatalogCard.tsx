import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CatalogItem } from '../../types';
import styles from '../../styles/ItemCatalog.styles';

type Props = {
  item: CatalogItem;
  disabled: boolean;
  onEdit: (item: CatalogItem) => void;
  onArchive: (item: CatalogItem) => void;
};

export default function ItemCatalogCard({ item, disabled, onEdit, onArchive }: Props) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeading}>
        <View style={styles.itemIdentity}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemCode}>{item.code}</Text>
          </View>
          <Text style={styles.unitSummary} numberOfLines={1}>
            {item.primary_unit.code} → {item.secondary_unit?.code ?? 'None'} · Stock: {item.inventory_unit.code}
            {item.default_kg_per_crate ? ` · ~${item.default_kg_per_crate} kg/crate` : ''}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => onEdit(item)} disabled={disabled} hitSlop={8}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onArchive(item)} disabled={disabled} hitSlop={8}>
            <Text style={styles.archiveText}>Archive</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.variantRow}>
        {item.variants.map((variant) => (
          <View key={variant.id} style={styles.variantBadge}>
            <Text style={styles.variantBadgeText}>{variant.grade_code}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
