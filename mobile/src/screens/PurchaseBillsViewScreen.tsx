import React, { useMemo, useState, useEffect } from 'react';
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
import { getPurchaseBillDetails, getPurchaseBills } from '../api/stock';
import BillCorrectionModal from '../components/BillCorrectionModal';
import {
  groupPurchaseBills,
  type PurchaseBillSummary,
  type PurchaseBillViewMode,
} from '../domain/purchaseBills';
import { formatBusinessDate } from '../utils/date';
import { useBusinessConfig } from '../context/BusinessConfigContext';

export default function PurchaseBillsViewScreen() {
  const { formatMoney } = useBusinessConfig();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [bills, setBills] = useState<PurchaseBillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<PurchaseBillViewMode>('date');
  const [correctionTarget, setCorrectionTarget] = useState<PurchaseBillSummary | null>(null);
  const [correctingBillId, setCorrectingBillId] = useState<number | null>(null);

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

  const groupedBills = useMemo(() => groupPurchaseBills(bills, viewMode), [bills, viewMode]);

  const correctBill = async (reason: string) => {
    if (!correctionTarget) return;
    setCorrectingBillId(correctionTarget.id);
    try {
      const details = await getPurchaseBillDetails(correctionTarget.id);
      const purchases = details.items.map((item: {
        purchase_id: number;
        fish_variety_id: number;
        fish_variety_name: string;
        quantity_crates: number;
        quantity_kg: number;
        actual_weight: number;
      }) => ({
        id: item.purchase_id,
        supplier_id: details.supplier_id,
        supplier_type: details.supplier_type,
        fish_variety_id: item.fish_variety_id,
        fish_variety_name: item.fish_variety_name,
        quantity_crates: item.quantity_crates,
        quantity_kg: item.quantity_kg,
        default_kg_per_crate: item.quantity_crates > 0
          ? (Number(item.actual_weight) - Number(item.quantity_kg)) / item.quantity_crates
          : undefined,
        purchase_date: details.bill_date,
        billing_status: 'billed',
      }));
      setCorrectionTarget(null);
      navigation.navigate('PurchaseBillGeneration', {
        supplier_id: details.supplier_id,
        supplier_name: details.supplier_name,
        farmer_name: details.secondary_name,
        location: details.location,
        purchases,
        date: details.bill_date,
        correction: { reason, bill: details },
      });
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : 'Please try again.';
      Alert.alert(
        'Unable to correct bill',
        message,
      );
    } finally {
      setCorrectingBillId(null);
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
          style={[styles.filterButton, viewMode === 'supplier' && styles.filterButtonActive]}
          onPress={() => setViewMode('supplier')}
        >
          <Text style={[styles.filterButtonText, viewMode === 'supplier' && styles.filterButtonTextActive]}>
            By Supplier
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
                {viewMode === 'supplier' && Number(group.totalDue) > 0 && (
                  <Text style={styles.groupDue}>
                    Due: {formatMoney(Number(group.totalDue), 0)}
                  </Text>
                )}
              </View>
              {group.bills.map((bill) => (
                <View
                  key={bill.id}
                  style={styles.billCard}
                >
                  <TouchableOpacity
                    style={styles.billTapArea}
                    onPress={() => navigation.navigate('PurchaseBillDetails', { billId: bill.id })}
                  >
                  <View style={styles.billHeader}>
                    <View>
                      <Text style={styles.billNumber}>{bill.bill_number}</Text>
                      {viewMode === 'date' && (
                        <>
                          <Text style={styles.farmerName}>{bill.supplier_name || 'Unknown Supplier'}</Text>
                          {(bill.location || bill.secondary_name) && (
                            <Text style={styles.billSubtitle}>
                              {bill.location && bill.location}
                              {bill.location && bill.secondary_name && ' • '}
                              {bill.secondary_name && bill.secondary_name}
                            </Text>
                          )}
                        </>
                      )}
                      {viewMode === 'supplier' && (
                        <Text style={styles.billDate}>
                          {formatBusinessDate(bill.bill_date)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.billAmounts}>
                      <Text style={styles.billTotal}>
                        {formatMoney(Number(bill.total), 0)}
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
                        {formatBusinessDate(bill.bill_date)}
                      </Text>
                      {bill.balance_due > 0 && (
                        <Text style={styles.balanceDue}>
                          Due: {formatMoney(bill.balance_due, 0)}
                        </Text>
                      )}
                    </View>
                  )}
                  {viewMode === 'supplier' && bill.balance_due > 0 && (
                    <View style={styles.billFooter}>
                      <Text style={styles.balanceDue}>
                        Due: {formatMoney(bill.balance_due, 0)}
                      </Text>
                    </View>
                  )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBillButton}
                    disabled={correctingBillId === bill.id}
                    onPress={() => setCorrectionTarget(bill)}
                  >
                    {correctingBillId === bill.id
                      ? <ActivityIndicator size="small" color="#B45309" />
                      : <Text style={styles.deleteBillText}>Correct bill</Text>}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
      <BillCorrectionModal
        visible={Boolean(correctionTarget)}
        billNumber={correctionTarget?.bill_number}
        documentLabel="purchase bill"
        saving={correctingBillId !== null}
        paymentsCarriedForward
        onClose={() => setCorrectionTarget(null)}
        onConfirm={correctBill}
      />
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
  billTapArea: {
    flex: 1,
  },
  deleteBillButton: {
    alignItems: 'flex-end',
    borderTopColor: '#F3F4F6',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  deleteBillText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
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
