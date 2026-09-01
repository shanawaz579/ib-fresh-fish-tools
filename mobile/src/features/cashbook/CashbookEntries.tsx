import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CashbookEntry } from '../../types';
import styles from '../../styles/CashbookScreen.styles';

type Props = {
  entries: CashbookEntry[];
  isClosed: boolean;
  formatMoney: (amount: number, fractionDigits?: number) => string;
  onVoidAdjustment: (id: number) => void;
};

export default function CashbookEntries({ entries, isClosed, formatMoney, onVoidAdjustment }: Props) {
  return (
    <View style={styles.entriesSection}>
      <View style={styles.entriesHeading}><View><Text style={styles.sectionTitle}>Cash entries</Text><Text style={styles.cardSubtitle}>Source transactions remain in their original modules</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{entries.length}</Text></View></View>
      {entries.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>No cash movement</Text><Text style={styles.emptyText}>Cash receipts, payments, expenses, and adjustments will appear here.</Text></View>
      ) : entries.map((entry) => {
        const voided = Boolean(entry.voided_at);
        return (
          <View key={`${entry.entry_type}-${entry.source_id}`} style={[styles.entryRow, voided && styles.voidedRow]}>
            <View style={[styles.entryDirection, entry.direction === 'in' ? styles.entryDirectionIn : styles.entryDirectionOut]}><Text style={styles.entryDirectionText}>{entry.direction === 'in' ? '↓' : '↑'}</Text></View>
            <View style={styles.entryCopy}>
              <Text style={[styles.entryLabel, voided && styles.voidedText]} numberOfLines={1}>{entry.label}</Text>
              <Text style={styles.entryMeta}>{[entry.detail, entry.reference_number].filter(Boolean).join(' · ')}</Text>
              {voided ? <Text style={styles.voidReason}>Voided · {entry.void_reason}</Text> : null}
            </View>
            <View style={styles.entryAmountCopy}>
              <Text style={[styles.entryAmount, entry.direction === 'in' ? styles.inText : styles.outText, voided && styles.voidedText]}>{entry.direction === 'in' ? '+' : '−'}{formatMoney(entry.amount, 0)}</Text>
              {entry.entry_type === 'adjustment' && !voided && !isClosed ? <TouchableOpacity onPress={() => onVoidAdjustment(entry.source_id)}><Text style={styles.voidAction}>Void</Text></TouchableOpacity> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
