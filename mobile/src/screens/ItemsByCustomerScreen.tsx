import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { getSalesByDate } from '../api/stock';
import type { Sale } from '../types';

// Helper to extract size from variety name
const SIZE_ORDER = ['Big', 'Medium', 'Small'];

function extractSizeAndName(varietyName: string): { name: string; size: string } {
  for (const s of SIZE_ORDER) {
    if (varietyName.includes(s)) {
      const name = varietyName.replace(s, '').trim();
      const size = s.charAt(0); // Get first letter: B, M, S
      return { name, size };
    }
  }
  return { name: varietyName, size: '' };
}

interface CustomerPurchase {
  customerId: number;
  customerName: string;
  quantityCrates: number;
  quantityKg: number;
}

interface ItemGroup {
  varietyId: number;
  varietyName: string;
  totalCrates: number;
  totalKg: number;
  customers: CustomerPurchase[];
}

export default function ItemsByCustomerScreen() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const salesData = await getSalesByDate(date);

    // Group sales by fish variety
    const grouped: { [key: number]: ItemGroup } = {};

    salesData.forEach((sale: Sale) => {
      const varietyId = sale.fish_variety_id;
      const varietyName = sale.fish_variety_name || 'Unknown Fish';

      if (!grouped[varietyId]) {
        grouped[varietyId] = {
          varietyId,
          varietyName,
          totalCrates: 0,
          totalKg: 0,
          customers: [],
        };
      }

      grouped[varietyId].totalCrates += sale.quantity_crates;
      grouped[varietyId].totalKg += sale.quantity_kg;

      grouped[varietyId].customers.push({
        customerId: sale.customer_id,
        customerName: sale.customer_name || 'Unknown Customer',
        quantityCrates: sale.quantity_crates,
        quantityKg: sale.quantity_kg,
      });
    });

    // Convert to array and sort by variety name
    const itemGroupsArray = Object.values(grouped).sort((a, b) =>
      a.varietyName.localeCompare(b.varietyName)
    );

    setItemGroups(itemGroupsArray);

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const toggleItemExpanded = (varietyId: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(varietyId)) {
        newSet.delete(varietyId);
      } else {
        newSet.add(varietyId);
      }
      return newSet;
    });
  };

  const goToPreviousDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 Items by Customer</Text>
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
        ) : itemGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No sales for this date</Text>
          </View>
        ) : (
          itemGroups.map((item) => {
            const isExpanded = expandedItems.has(item.varietyId);
            const { name, size } = extractSizeAndName(item.varietyName);

            return (
              <View key={item.varietyId} style={styles.itemCard}>
                <TouchableOpacity
                  style={styles.itemHeader}
                  onPress={() => toggleItemExpanded(item.varietyId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemHeaderLeft}>
                    <View style={styles.fishNameContainer}>
                      <Text style={styles.fishName}>{name}</Text>
                      {size && (
                        <View style={[
                          styles.sizeBadge,
                          size === 'B' && styles.sizeBadgeBig,
                          size === 'M' && styles.sizeBadgeMedium,
                          size === 'S' && styles.sizeBadgeSmall,
                        ]}>
                          <Text style={styles.sizeBadgeText}>{size}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.customerCount}>
                      {item.customers.length} customer{item.customers.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.itemHeaderRight}>
                    <Text style={styles.totalCrates}>{item.totalCrates}</Text>
                    {item.totalKg > 0 && (
                      <Text style={styles.totalKg}>{item.totalKg.toFixed(1)} Kg</Text>
                    )}
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.customerList}>
                    {item.customers.map((customer, index) => (
                      <View
                        key={`${customer.customerId}-${index}`}
                        style={[
                          styles.customerRow,
                          index === item.customers.length - 1 && styles.customerRowLast,
                        ]}
                      >
                        <Text style={styles.customerName}>{customer.customerName}</Text>
                        <View style={styles.customerQuantity}>
                          <Text style={styles.customerCrates}>{customer.quantityCrates}</Text>
                          {customer.quantityKg > 0 && (
                            <Text style={styles.customerKg}>{customer.quantityKg} Kg</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
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
    backgroundColor: '#3B82F6',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  dateButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 12,
  },
  todayButton: {
    padding: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    marginLeft: 8,
  },
  todayButtonText: {
    color: '#fff',
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
    fontSize: 16,
    color: '#6B7280',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  itemHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  fishNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fishName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  sizeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBadgeBig: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  sizeBadgeMedium: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  sizeBadgeSmall: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  sizeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  customerCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemHeaderRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  totalCrates: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  totalKg: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 14,
    color: '#6B7280',
    width: 20,
    textAlign: 'center',
  },
  customerList: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  customerRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 16,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  customerQuantity: {
    alignItems: 'flex-end',
  },
  customerCrates: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerKg: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
