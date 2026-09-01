import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Purchase } from '../../types';
import type { PurchaseGroup } from './usePurchaseRecords';
import styles from '../../styles/PurchaseScreen.styles';

type Props = {
  group: PurchaseGroup;
  collapsed: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onBill: (purchases: Purchase[]) => void;
};

export default function PurchaseGroupCard({ group, collapsed, onToggle, onEdit, onBill }: Props) {
  const unbilled = group.purchases.filter((purchase) => purchase.billing_status === 'unbilled');
  const totalCrates = group.purchases.reduce((sum, purchase) => sum + purchase.quantity_crates, 0);
  const totalKg = group.purchases.reduce((sum, purchase) => sum + Number(purchase.quantity_kg), 0);

  return (
    <View style={styles.groupCard}>
      <TouchableOpacity style={styles.groupHeader} onPress={onToggle} activeOpacity={0.75}>
        <Text style={styles.collapseIcon}>{collapsed ? '▶' : '▼'}</Text>
        <View style={styles.groupIdentity}>
          <Text style={styles.mediatorName} numberOfLines={1}>{group.supplierName}</Text>
          <Text style={styles.groupSubtitle} numberOfLines={1}>
            {group.supplierType === 'farmer' ? 'Direct' : `Farmer: ${group.farmerName}`}
            {group.location ? ` · ${group.location}` : ''}
          </Text>
        </View>
        <View style={styles.totalBadge}>
          {totalCrates > 0 ? <Text style={styles.totalBadgeText}>{totalCrates} cr</Text> : null}
          {totalKg > 0 ? <Text style={styles.totalBadgeSubtext}>{totalKg} kg</Text> : null}
        </View>
      </TouchableOpacity>

      <View style={styles.groupMetaRow}>
        <Text style={[styles.statusText, unbilled.length === 0 && styles.billedText]}>
          {unbilled.length === 0 ? 'Billed' : 'Unbilled'}
        </Text>
        <View style={styles.groupActions}>
          {unbilled.length > 0 ? (
            <TouchableOpacity style={styles.editGroupButton} onPress={onEdit}>
              <Text style={styles.editGroupButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {unbilled.length > 0 ? (
            <TouchableOpacity style={styles.billButton} onPress={() => onBill(unbilled)}>
              <Text style={styles.billButtonText}>Create bill</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!collapsed ? group.purchases.map((purchase) => (
        <View key={purchase.id} style={styles.purchaseRow}>
          <Text style={styles.purchaseName} numberOfLines={1}>{purchase.fish_variety_name}</Text>
          <Text style={styles.purchaseQuantity} numberOfLines={1}>
            {[
              purchase.quantity_crates > 0 ? `${purchase.quantity_crates} cr` : '',
              purchase.quantity_kg > 0 ? `${purchase.quantity_kg} kg` : '',
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )) : null}
    </View>
  );
}
