import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getCustomers, getBillsByCustomer, deleteBill } from '../api/stock';
import type { Customer, Bill } from '../types';

export default function BillsViewScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadBills(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    const customersData = await getCustomers();
    setCustomers(customersData);
  };

  const loadBills = async (customerId: number) => {
    setLoading(true);
    const billsData = await getBillsByCustomer(customerId);
    setBills(billsData);
    setLoading(false);
  };

  const handleCustomerSelect = (customerId: number | null) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setBills([]);
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'paid' ? '#10B981' : '#EF4444';
  };

  const getStatusBadge = (bill: Bill) => {
    const isActive = bill.is_active ?? false;
    const isPaid = bill.status === 'paid';

    if (isPaid) {
      return { text: 'PAID', color: '#10B981', bg: '#D1FAE5' };
    } else if (isActive) {
      return { text: 'ACTIVE', color: '#3B82F6', bg: '#DBEAFE' };
    } else {
      return { text: 'INACTIVE', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const handleDeleteBill = (bill: Bill) => {
    const badge = getStatusBadge(bill);
    const hasItems = bill.items && bill.items.length > 0;

    let warningMessage = `Are you sure you want to delete bill ${bill.bill_number}?\n\n`;
    warningMessage += `Status: ${badge.text}\n`;
    warningMessage += `Amount: ₹${bill.total.toLocaleString('en-IN')}\n`;

    if (bill.is_active) {
      warningMessage += `\n⚠️ WARNING: This is the ACTIVE bill for this customer!`;
    }

    if (hasItems) {
      warningMessage += `\n\nThis bill has ${bill.items.length} item(s).`;
    }

    warningMessage += `\n\nThis action cannot be undone.`;

    Alert.alert(
      'Delete Bill',
      warningMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteBill(bill.id);
            if (success) {
              Alert.alert('Success', 'Bill deleted successfully');
              if (selectedCustomerId) {
                loadBills(selectedCustomerId);
              }
            } else {
              Alert.alert('Error', 'Failed to delete bill');
            }
          },
        },
      ]
    );
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bills View</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Customer Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Customer</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCustomerId}
              onValueChange={handleCustomerSelect}
              style={styles.picker}
            >
              <Picker.Item label="-- Select Customer --" value={null} />
              {customers.map(customer => (
                <Picker.Item
                  key={customer.id}
                  label={customer.name}
                  value={customer.id}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Bills Summary */}
        {selectedCustomerId && (
          <View style={styles.summaryCard}>
            <Text style={styles.customerName}>{selectedCustomer?.name}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Bills:</Text>
              <Text style={styles.summaryValue}>{bills.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Active Bills:</Text>
              <Text style={styles.summaryValue}>
                {bills.filter(b => b.is_active).length}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Inactive Bills:</Text>
              <Text style={styles.summaryValue}>
                {bills.filter(b => !b.is_active && b.status === 'unpaid').length}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid Bills:</Text>
              <Text style={styles.summaryValue}>
                {bills.filter(b => b.status === 'paid').length}
              </Text>
            </View>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        )}

        {/* Bills List */}
        {!loading && bills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Bills</Text>
            {bills.map((bill) => {
              const badge = getStatusBadge(bill);
              return (
                <View key={bill.id} style={styles.billCard}>
                  <View style={styles.billHeader}>
                    <View style={styles.billHeaderLeft}>
                      <Text style={styles.billNumber}>{bill.bill_number}</Text>
                      <Text style={styles.billDate}>
                        {new Date(bill.bill_date).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                    <View style={styles.billHeaderRight}>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.color }]}>
                          {badge.text}
                        </Text>
                      </View>
                      <Text style={styles.billTotal}>
                        ₹{bill.total.toLocaleString('en-IN')}
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteBill(bill)}
                      >
                        <Text style={styles.deleteIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.billDetails}>
                    <View style={styles.billDetailRow}>
                      <Text style={styles.billDetailLabel}>Previous Balance:</Text>
                      <Text style={styles.billDetailValue}>
                        ₹{bill.previous_balance?.toLocaleString('en-IN') || '0'}
                      </Text>
                    </View>
                    <View style={styles.billDetailRow}>
                      <Text style={styles.billDetailLabel}>Amount Paid:</Text>
                      <Text style={[styles.billDetailValue, styles.paidAmount]}>
                        -₹{bill.amount_paid?.toLocaleString('en-IN') || '0'}
                      </Text>
                    </View>
                    <View style={styles.billDetailRow}>
                      <Text style={styles.billDetailLabel}>Balance Due:</Text>
                      <Text style={styles.billDetailValue}>
                        ₹{bill.balance_due?.toLocaleString('en-IN') || '0'}
                      </Text>
                    </View>
                    <View style={styles.billDetailRow}>
                      <Text style={styles.billDetailLabel}>Subtotal:</Text>
                      <Text style={styles.billDetailValue}>
                        ₹{bill.subtotal?.toLocaleString('en-IN') || '0'}
                      </Text>
                    </View>
                    {bill.discount > 0 && (
                      <View style={styles.billDetailRow}>
                        <Text style={styles.billDetailLabel}>Discount:</Text>
                        <Text style={[styles.billDetailValue, styles.paidAmount]}>
                          -₹{bill.discount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {bill.notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Notes:</Text>
                      <Text style={styles.notesText}>{bill.notes}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {!loading && selectedCustomerId && bills.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No bills found</Text>
            <Text style={styles.emptySubtext}>
              This customer has no bills in the system
            </Text>
          </View>
        )}

        {/* No Selection State */}
        {!selectedCustomerId && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Select a customer</Text>
            <Text style={styles.emptySubtext}>
              Choose a customer from the dropdown to view their bills
            </Text>
          </View>
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
    backgroundColor: '#10B981',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  picker: {
    height: 50,
  },
  summaryCard: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#78350F',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  billCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  billHeaderLeft: {
    flex: 1,
  },
  billNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  billDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  billHeaderRight: {
    alignItems: 'flex-end',
  },
  deleteButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteIcon: {
    fontSize: 18,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  billTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  billDetails: {
    gap: 8,
  },
  billDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  billDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  paidAmount: {
    color: '#10B981',
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#374151',
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
