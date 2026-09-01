import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatBusinessDate } from '../utils/date';

type DateNavigatorProps = {
  date: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  accentColor?: string;
  canGoNext?: boolean;
};

export default function DateNavigator({
  date,
  onPrevious,
  onNext,
  onToday,
  accentColor = '#3B82F6',
  canGoNext = true,
}: DateNavigatorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity accessibilityLabel="Previous day" onPress={onPrevious} style={styles.arrowButton}>
        <Text style={styles.arrowText}>←</Text>
      </TouchableOpacity>
      <Text style={styles.dateText}>{formatBusinessDate(date)}</Text>
      <TouchableOpacity accessibilityLabel="Next day" disabled={!canGoNext} onPress={onNext} style={[styles.arrowButton, !canGoNext && styles.disabledArrow]}>
        <Text style={[styles.arrowText, !canGoNext && styles.disabledArrowText]}>→</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToday} style={[styles.todayButton, { backgroundColor: accentColor }]}>
        <Text style={styles.todayText}>Today</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
  },
  arrowButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 8,
    padding: 12,
  },
  arrowText: {
    color: '#374151',
    fontSize: 20,
    fontWeight: 'bold',
  },
  disabledArrow: { opacity: 0.45 },
  disabledArrowText: { color: '#94A3B8' },
  dateText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  todayButton: {
    borderRadius: 8,
    marginLeft: 8,
    padding: 12,
  },
  todayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
