import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CustomerOutstandingCardProps {
  totalOutstanding: number;
  unpaidBillsCount: number;
  oldestBillDate: string | null;
}

export default function CustomerOutstandingCard({
  totalOutstanding,
  unpaidBillsCount,
  oldestBillDate,
}: CustomerOutstandingCardProps) {
  if (totalOutstanding === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noOutstanding}>✓ No Outstanding Balance</Text>
      </View>
    );
  }

  const daysSinceOldest = oldestBillDate
    ? Math.floor((Date.now() - new Date(oldestBillDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Customer Outstanding</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Total Pending:</Text>
          <Text style={styles.amountValue}>₹{totalOutstanding.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Unpaid Bills</Text>
            <Text style={styles.infoValue}>{unpaidBillsCount}</Text>
          </View>
          {oldestBillDate && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Oldest Bill</Text>
              <Text style={[styles.infoValue, daysSinceOldest > 30 && styles.overdueText]}>
                {daysSinceOldest} days ago
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FDE68A',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#F59E0B',
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    padding: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 20,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#78350F',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
  },
  overdueText: {
    color: '#DC2626',
  },
  noOutstanding: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    textAlign: 'center',
    padding: 16,
  },
});
