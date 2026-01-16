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

export default function PurchaseBillsViewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          bills.map((bill) => (
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
                  <Text style={styles.farmerName}>{bill.farmer_name || 'Unknown Farmer'}</Text>
                  {(bill.location || bill.secondary_name) && (
                    <Text style={styles.billSubtitle}>
                      {bill.location && bill.location}
                      {bill.location && bill.secondary_name && ' • '}
                      {bill.secondary_name && bill.secondary_name}
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
            </TouchableOpacity>
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
  content: {
    flex: 1,
    padding: 16,
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
