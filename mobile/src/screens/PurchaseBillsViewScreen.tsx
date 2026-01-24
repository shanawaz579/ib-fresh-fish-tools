import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getPurchaseBills } from '../api/stock';

type PurchaseBill = {
  id: number;
  bill_number: string;
  farmer_id: number;
  farmer_name?: string;
  bill_date: string;
  total: number;
  payment_status: string;
  amount_paid: number;
  balance_due: number;
  location?: string;
  secondary_name?: string;
};

type ViewMode = 'date' | 'farmer';

export default function PurchaseBillsViewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('date');

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    setLoading(true);
    try {
      const data = await getPurchaseBills();
      setBills(data);
    } catch (error) {
      console.error('Error loading purchase bills:', error);
      Alert.alert('Error', 'Failed to load purchase bills');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getPurchaseBills();
      setBills(data);
    } catch (error) {
      console.error('Error refreshing purchase bills:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Group bills by date
  const groupByDate = () => {
    const grouped: { [key: string]: PurchaseBill[] } = {};
    bills.forEach(bill => {
      const date = bill.bill_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(bill);
    });

    // Sort dates descending (newest first)
    return Object.keys(grouped)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(date => ({
        key: date,
        displayName: new Date(date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        bills: grouped[date].sort((a, b) => b.id - a.id)
      }));
  };

  // Group bills by farmer
  const groupByFarmer = () => {
    const grouped: { [key: string]: PurchaseBill[] } = {};
    bills.forEach(bill => {
      const farmerKey = `${bill.farmer_id}_${bill.farmer_name || 'Unknown'}`;
      if (!grouped[farmerKey]) {
        grouped[farmerKey] = [];
      }
      grouped[farmerKey].push(bill);
    });

    // Sort by farmer name
    return Object.keys(grouped)
      .sort((a, b) => {
        const nameA = a.split('_')[1];
        const nameB = b.split('_')[1];
        return nameA.localeCompare(nameB);
      })
      .map(key => {
        const farmerName = key.split('_')[1];
        const farmerBills = grouped[key];
        const totalDue = farmerBills.reduce((sum, bill) => sum + bill.balance_due, 0);

        return {
          key: key,
          displayName: farmerName,
          totalDue: totalDue,
          bills: farmerBills.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime())
        };
      });
  };

  const groupedBills = viewMode === 'date' ? groupByDate() : groupByFarmer();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading purchase bills...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Purchase Bills</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Filter Toggle */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, viewMode === 'date' && styles.filterButtonActive]}
          onPress={() => setViewMode('date')}
        >
          <Text style={[styles.filterButtonText, viewMode === 'date' && styles.filterButtonTextActive]}>
            By Date
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, viewMode === 'farmer' && styles.filterButtonActive]}
          onPress={() => setViewMode('farmer')}
        >
          <Text style={[styles.filterButtonText, viewMode === 'farmer' && styles.filterButtonTextActive]}>
            By Farmer
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {bills.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Purchase Bills Yet</Text>
            <Text style={styles.emptyText}>
              Purchase bills you create will appear here.{'\n'}
              Go to Purchase Records to generate bills.
            </Text>
          </View>
        ) : (
          groupedBills.map((group) => (
            <View key={group.key} style={styles.groupContainer}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{group.displayName}</Text>
                {viewMode === 'farmer' && group.totalDue > 0 && (
                  <Text style={styles.groupDue}>
                    Due: ₹{group.totalDue.toLocaleString('en-IN')}
                  </Text>
                )}
              </View>
              {group.bills.map((bill) => (
                <TouchableOpacity
                  key={bill.id}
                  style={styles.billCard}
                  onPress={() => {
                    navigation.navigate('PurchaseBillDetails', { billId: bill.id });
                  }}
                >
                  <View style={styles.billHeader}>
                    <View>
                      <Text style={styles.billNumber}>{bill.bill_number}</Text>
                      {viewMode === 'date' && (
                        <>
                          <Text style={styles.farmerName}>{bill.farmer_name || 'Unknown Farmer'}</Text>
                          {(bill.location || bill.secondary_name) && (
                            <Text style={styles.billSubtitle}>
                              {bill.location && bill.location}
                              {bill.location && bill.secondary_name && ' • '}
                              {bill.secondary_name && bill.secondary_name}
                            </Text>
                          )}
                        </>
                      )}
                      {viewMode === 'farmer' && (
                        <Text style={styles.billDate}>
                          {new Date(bill.bill_date).toLocaleDateString('en-IN')}
                        </Text>
                      )}
                    </View>
                    <View style={styles.billAmounts}>
                      <Text style={styles.billTotal}>
                        ₹{Number(bill.total).toLocaleString('en-IN', {
                          maximumFractionDigits: 0
                        })}
                      </Text>
                      <View style={[
                        styles.statusBadge,
                        bill.payment_status === 'paid' && styles.statusPaid,
                        bill.payment_status === 'pending' && styles.statusPending,
                        bill.payment_status === 'partial' && styles.statusPartial,
                      ]}>
                        <Text style={[
                          styles.statusText,
                          bill.payment_status === 'paid' && styles.statusTextPaid,
                          bill.payment_status === 'pending' && styles.statusTextPending,
                          bill.payment_status === 'partial' && styles.statusTextPartial,
                        ]}>
                          {bill.payment_status === 'paid' && 'Paid'}
                          {bill.payment_status === 'pending' && 'Pending'}
                          {bill.payment_status === 'partial' && 'Partial'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {viewMode === 'date' && (
                    <View style={styles.billFooter}>
                      <Text style={styles.billDate}>
                        {new Date(bill.bill_date).toLocaleDateString('en-IN')}
                      </Text>
                      {bill.balance_due > 0 && (
                        <Text style={styles.balanceDue}>
                          Due: ₹{bill.balance_due.toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>
                  )}
                  {viewMode === 'farmer' && bill.balance_due > 0 && (
                    <View style={styles.billFooter}>
                      <Text style={styles.balanceDue}>
                        Due: ₹{bill.balance_due.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 50,
  },
  backButton: {
    fontSize: 16,
    color: '#0EA5E9',
    width: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#0EA5E9',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  groupContainer: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  groupDue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  billCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  farmerName: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 2,
  },
  billSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  billAmounts: {
    alignItems: 'flex-end',
  },
  billTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPartial: {
    backgroundColor: '#DBEAFE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextPaid: {
    color: '#065F46',
  },
  statusTextPending: {
    color: '#92400E',
  },
  statusTextPartial: {
    color: '#1E40AF',
  },
  billFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  billDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  balanceDue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
});
