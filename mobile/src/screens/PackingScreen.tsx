import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { getSalesByDate, getPackingStatusByDate, togglePackingStatus, clearPackingStatusByDate } from '../api/stock';
import type { Sale } from '../types';
import { useAuth } from '../context/AuthContext';

interface PackingItem {
  saleId: number;
  fishVarietyName: string;
  quantityCrates: number;
  quantityKg: number;
  totalWeight: number;
  loaded: boolean;
}

interface CustomerGroup {
  customerId: number;
  customerName: string;
  items: PackingItem[];
  totalBoxes: number;
}

const translations = {
  en: {
    title: 'Packing List',
    customer: 'Customer',
    boxes: 'Boxes',
    total: 'Total Boxes',
    loaded: 'Loaded',
    noSales: 'No sales for today',
    logout: 'Logout',
    inProgress: 'In Progress',
    completed: 'Completed',
  },
};

// Colors for different customers
const CUSTOMER_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Orange
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#F97316', // Orange-red
];

export default function PackingScreen() {
  const { signOut, user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedItems, setLoadedItems] = useState<Set<number>>(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState<Set<number>>(new Set());
  const [completedSectionExpanded, setCompletedSectionExpanded] = useState(false);

  const t = translations.en;

  useEffect(() => {
    loadData();
  }, [date]);

  useEffect(() => {
    // Auto-expand all in-progress customers
    const inProgressCustomers = customerGroups
      .filter(g => g.items.some(item => !loadedItems.has(item.saleId)))
      .map(g => g.customerId);
    setExpandedCustomers(new Set(inProgressCustomers));
  }, [customerGroups, loadedItems]);

  const loadData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const salesData = await getSalesByDate(date);
    const packingStatusMap = await getPackingStatusByDate(date);

    // Update loadedItems state from database
    setLoadedItems(new Set(
      Array.from(packingStatusMap.entries())
        .filter(([_, loaded]) => loaded)
        .map(([saleId, _]) => saleId)
    ));

    // Group sales by customer
    const grouped = salesData.reduce((acc: { [key: number]: CustomerGroup }, sale: Sale) => {
      const customerId = sale.customer_id;

      if (!acc[customerId]) {
        acc[customerId] = {
          customerId,
          customerName: sale.customer_name || 'Unknown Customer',
          items: [],
          totalBoxes: 0,
        };
      }

      const totalWeight = (sale.quantity_crates * 35) + sale.quantity_kg;

      acc[customerId].items.push({
        saleId: sale.id,
        fishVarietyName: sale.fish_variety_name || 'Unknown Fish',
        quantityCrates: sale.quantity_crates,
        quantityKg: sale.quantity_kg,
        totalWeight,
        loaded: packingStatusMap.get(sale.id) || false,
      });

      acc[customerId].totalBoxes += sale.quantity_crates;

      return acc;
    }, {});

    setCustomerGroups(Object.values(grouped));

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const toggleLoaded = async (saleId: number) => {
    const currentlyLoaded = loadedItems.has(saleId);
    const newLoadedState = !currentlyLoaded;

    // Optimistically update UI
    setLoadedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });

    // Save to database
    const success = await togglePackingStatus(saleId, newLoadedState, user?.email || '');

    if (!success) {
      // Revert on failure
      setLoadedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(saleId)) {
          newSet.delete(saleId);
        } else {
          newSet.add(saleId);
        }
        return newSet;
      });
      Alert.alert('Error', 'Failed to update packing status');
    }
  };

  const toggleCustomerExpanded = (customerId: number) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const isCustomerCompleted = (group: CustomerGroup) => {
    return group.items.every(item => loadedItems.has(item.saleId));
  };

  const handleLogout = () => {
    Alert.alert(
      t.logout,
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: t.logout, style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const goToPreviousDay = () => {
    const currentDate = new Date(date);
    currentDate.setDate(currentDate.getDate() - 1);
    setDate(currentDate.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const currentDate = new Date(date);
    currentDate.setDate(currentDate.getDate() + 1);
    setDate(currentDate.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleResetPackingStatus = () => {
    Alert.alert(
      'Reset Packing Status',
      'This will clear all loaded checkmarks for this day. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const success = await clearPackingStatusByDate(date);
            if (success) {
              setLoadedItems(new Set());
              loadData(true);
            } else {
              Alert.alert('Error', 'Failed to reset packing status');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📦 {t.title}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleResetPackingStatus} style={styles.resetButton}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>{t.logout}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Picker */}
      <View style={styles.dateContainer}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>
          {new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
        <TouchableOpacity onPress={goToNextDay} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} tintColor="#3B82F6" />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
        ) : customerGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t.noSales}</Text>
          </View>
        ) : (
          <>
            {/* In Progress Section */}
            {customerGroups.filter(g => !isCustomerCompleted(g)).length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>📦 {t.inProgress}</Text>
                </View>
                {customerGroups.map((group, index) => {
                  if (isCustomerCompleted(group)) return null;

                  const isExpanded = expandedCustomers.has(group.customerId);

                  return (
                    <View
                      key={`progress-${group.customerId}`}
                      style={[
                        styles.customerCard,
                        { borderLeftColor: CUSTOMER_COLORS[index % CUSTOMER_COLORS.length] }
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.customerHeader,
                          { backgroundColor: CUSTOMER_COLORS[index % CUSTOMER_COLORS.length] }
                        ]}
                        onPress={() => toggleCustomerExpanded(group.customerId)}
                      >
                        <Text style={styles.customerName}>
                          {group.customerName}
                        </Text>
                        <Text style={styles.customerTotal}>
                          {group.totalBoxes} Boxes
                        </Text>
                        <Text style={styles.expandIcon}>
                          {isExpanded ? '▼' : '▶'}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && group.items.map((item) => (
                        <View key={item.saleId} style={styles.itemCard}>
                          <Text style={styles.fishName}>{item.fishVarietyName}</Text>
                          <Text style={styles.boxCount}>{item.quantityCrates} Boxes</Text>
                          <TouchableOpacity
                            style={[
                              styles.checkbox,
                              loadedItems.has(item.saleId) && styles.checkboxChecked
                            ]}
                            onPress={() => toggleLoaded(item.saleId)}
                          >
                            {loadedItems.has(item.saleId) && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            )}

            {/* Completed Section */}
            {customerGroups.filter(g => isCustomerCompleted(g)).length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setCompletedSectionExpanded(!completedSectionExpanded)}
                >
                  <Text style={styles.sectionTitle}>
                    ✅ {t.completed} ({customerGroups.filter(g => isCustomerCompleted(g)).length})
                  </Text>
                  <Text style={styles.sectionExpandIcon}>
                    {completedSectionExpanded ? '▼' : '▶'}
                  </Text>
                </TouchableOpacity>

                {completedSectionExpanded && customerGroups.map((group, index) => {
                  if (!isCustomerCompleted(group)) return null;

                  const isExpanded = expandedCustomers.has(group.customerId);

                  return (
                    <View
                      key={`completed-${group.customerId}`}
                      style={[
                        styles.customerCard,
                        styles.completedCard,
                        { borderLeftColor: CUSTOMER_COLORS[index % CUSTOMER_COLORS.length] }
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.customerHeader,
                          styles.completedHeader,
                          { backgroundColor: CUSTOMER_COLORS[index % CUSTOMER_COLORS.length] }
                        ]}
                        onPress={() => toggleCustomerExpanded(group.customerId)}
                      >
                        <Text style={styles.customerName}>
                          {group.customerName}
                        </Text>
                        <Text style={styles.customerTotal}>
                          {group.totalBoxes} Boxes
                        </Text>
                        <Text style={styles.expandIcon}>
                          {isExpanded ? '▼' : '▶'}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && group.items.map((item) => (
                        <View key={item.saleId} style={[styles.itemCard, styles.completedItem]}>
                          <Text style={[styles.fishName, styles.completedText]}>{item.fishVarietyName}</Text>
                          <Text style={[styles.boxCount, styles.completedText]}>{item.quantityCrates} Boxes</Text>
                          <TouchableOpacity
                            style={[styles.checkbox, styles.checkboxChecked]}
                            onPress={() => toggleLoaded(item.saleId)}
                          >
                            <Text style={styles.checkmark}>✓</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#0EA5E9',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  resetButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  resetText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dateButton: {
    padding: 12,
    marginHorizontal: 8,
  },
  dateButtonText: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    minWidth: 150,
    textAlign: 'center',
  },
  todayButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  todayButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#6B7280',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    flex: 1,
  },
  sectionExpandIcon: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  customerHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  customerTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
  },
  expandIcon: {
    fontSize: 16,
    color: '#fff',
    minWidth: 20,
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fishName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  boxCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0EA5E9',
    marginRight: 12,
    minWidth: 80,
    textAlign: 'right',
  },
  checkbox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  completedCard: {
    opacity: 0.7,
  },
  completedHeader: {
    opacity: 0.8,
  },
  completedItem: {
    backgroundColor: '#F9FAFB',
  },
  completedText: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
});
