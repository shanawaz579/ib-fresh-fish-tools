import styles from '../styles/PackingScreen.styles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { getSalesByDate, getPackingStatusByDate, togglePackingStatus, clearPackingStatusByDate, getCustomers } from '../api/stock';
import type { Sale, Customer } from '../types';
import { useAuth } from '../context/AuthContext';
import DateNavigator from '../components/DateNavigator';
import { getTotalWeightKg } from '../domain/fish';
import { useBusinessDate } from '../hooks/useBusinessDate';

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
  const { date, goToPreviousDay, goToNextDay, goToToday } = useBusinessDate();
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
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

    const [salesData, packingStatusMap, customersData] = await Promise.all([
      getSalesByDate(date),
      getPackingStatusByDate(date),
      getCustomers(),
    ]);
    setCustomers(customersData);

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

      const totalWeight = getTotalWeightKg(sale.quantity_crates, sale.quantity_kg);

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

    // Sort customer groups: Wholesale Market first, then others, both sorted by total boxes descending
    const sortedGroups = Object.values(grouped).sort((a, b) => {
      const customerA = customersData.find(c => c.id === a.customerId);
      const customerB = customersData.find(c => c.id === b.customerId);

      const isWholesaleA = customerA?.business_type === 'Wholesale Market';
      const isWholesaleB = customerB?.business_type === 'Wholesale Market';

      // Wholesale Market customers come first
      if (isWholesaleA && !isWholesaleB) return -1;
      if (!isWholesaleA && isWholesaleB) return 1;

      // Within each group, sort by total boxes (descending)
      return b.totalBoxes - a.totalBoxes;
    });

    setCustomerGroups(sortedGroups);

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

      <DateNavigator date={date} onPrevious={goToPreviousDay} onNext={goToNextDay} onToday={goToToday} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
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
