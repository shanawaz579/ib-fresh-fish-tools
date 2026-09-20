import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getUnbilledPurchases, getUnbilledSales } from '../../api/stock';
import type { Purchase, Sale } from '../../types';
import { formatBusinessDate, toLocalDateString } from '../../utils/date';
import styles from '../../styles/PendingBillsModal.styles';

export type PendingSalesGroup = {
  kind: 'sales'; key: string; date: string; partyId: number; partyName: string; lines: Sale[];
};
export type PendingPurchaseGroup = {
  kind: 'purchases'; key: string; date: string; partyId: number; partyName: string; farmerName: string;
  supplierType: 'mediator' | 'farmer'; location?: string; lines: Purchase[];
};
export type PendingBillGroup = PendingSalesGroup | PendingPurchaseGroup;

type Props = {
  visible: boolean;
  mode: 'sales' | 'purchases';
  onClose: () => void;
  onOpen: (group: PendingBillGroup) => void;
  onCountChange?: (count: number) => void;
};

type Filter = 'all' | 'today' | 'older';

export default function PendingBillsModal({ visible, mode, onClose, onOpen, onCountChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<PendingBillGroup[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        const nextGroups: PendingBillGroup[] = mode === 'sales'
          ? groupSales(await getUnbilledSales())
          : groupPurchases(await getUnbilledPurchases());
        if (active) {
          setGroups(nextGroups);
          onCountChange?.(nextGroups.length);
        }
      } catch (error) {
        console.error('Unable to load pending bills:', error);
        if (active) Alert.alert('Unable to load pending bills', 'Check the connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [mode, onCountChange, visible]);

  const today = toLocalDateString();
  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter(group => {
      if (filter === 'today' && group.date !== today) return false;
      if (filter === 'older' && group.date === today) return false;
      return !term || group.partyName.toLowerCase().includes(term)
        || group.lines.some(line => (line.fish_variety_name ?? '').toLowerCase().includes(term));
    });
  }, [filter, groups, search, today]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>ACROSS ALL DATES</Text><Text style={styles.title}>Pending {mode === 'sales' ? 'sales' : 'purchase'} bills</Text></View>
          <TouchableOpacity style={styles.close} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
        </View>
        <View style={styles.controls}>
          <TextInput value={search} onChangeText={setSearch} style={styles.search} placeholder={`Search ${mode === 'sales' ? 'customer' : 'supplier'} or item`} />
          <View style={styles.filters}>{(['all', 'today', 'older'] as Filter[]).map(value => (
            <TouchableOpacity key={value} style={[styles.filter, filter === value && styles.filterActive]} onPress={() => setFilter(value)}>
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'all' ? `All · ${groups.length}` : value === 'today' ? 'Today' : 'Older'}</Text>
            </TouchableOpacity>
          ))}</View>
        </View>
        {loading ? <ActivityIndicator color="#0F766E" size="large" style={styles.loader} /> : (
          <ScrollView contentContainerStyle={styles.list}>
            {visibleGroups.map(group => {
              const crates = group.lines.reduce((sum, line) => sum + line.quantity_crates, 0);
              const kg = group.lines.reduce((sum, line) => sum + Number(line.quantity_kg), 0);
              const items = group.lines.map(line => line.fish_variety_name ?? 'Unknown item');
              return <View key={group.key} style={styles.card}>
                <View style={styles.cardTop}><View style={styles.cardCopy}><Text style={styles.party}>{group.partyName}</Text><Text style={styles.date}>{formatBusinessDate(group.date)}</Text></View><View style={styles.quantity}><Text style={styles.quantityText}>{[crates ? `${crates} cr` : '', kg ? `${kg} kg` : ''].filter(Boolean).join(' · ')}</Text></View></View>
                {group.kind === 'purchases' ? <Text style={styles.context}>{group.supplierType === 'farmer' ? 'Direct' : `Farmer: ${group.farmerName}`}{group.location ? ` · ${group.location}` : ''}</Text> : null}
                <Text style={styles.items} numberOfLines={2}>{items.slice(0, 3).join(', ')}{items.length > 3 ? ` +${items.length - 3} more` : ''}</Text>
                <View style={styles.cardFooter}><Text style={styles.lineCount}>{group.lines.length} item{group.lines.length === 1 ? '' : 's'}</Text><TouchableOpacity style={styles.billButton} onPress={() => onOpen(group)}><Text style={styles.billButtonText}>Create bill</Text></TouchableOpacity></View>
              </View>;
            })}
            {!visibleGroups.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>{groups.length ? 'No matching pending bills' : 'Nothing pending'}</Text><Text style={styles.emptyText}>{groups.length ? 'Try another search or filter.' : 'All recorded transactions have been billed.'}</Text></View> : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function groupSales(rows: Sale[]): PendingSalesGroup[] {
  const grouped = new Map<string, PendingSalesGroup>();
  rows.forEach(line => {
    const key = `${line.sale_date}:${line.customer_id}`;
    const group = grouped.get(key);
    if (group) group.lines.push(line);
    else grouped.set(key, { kind: 'sales', key, date: line.sale_date, partyId: line.customer_id, partyName: line.customer_name ?? 'Unknown customer', lines: [line] });
  });
  return [...grouped.values()];
}

function groupPurchases(rows: Purchase[]): PendingPurchaseGroup[] {
  const grouped = new Map<string, PendingPurchaseGroup>();
  rows.forEach(line => {
    const key = `${line.purchase_date}:${line.supplier_id}:${line.farmer_id}:${line.location ?? ''}`;
    const group = grouped.get(key);
    if (group) group.lines.push(line);
    else grouped.set(key, { kind: 'purchases', key, date: line.purchase_date, partyId: line.supplier_id, partyName: line.supplier_name ?? 'Unknown supplier', farmerName: line.farmer_name ?? 'Unknown farmer', supplierType: line.supplier_type ?? 'mediator', location: line.location, lines: [line] });
  });
  return [...grouped.values()];
}
