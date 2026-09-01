import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getSupplierPaymentLedger } from '../api/purchaseBilling';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { SupplierLedgerAccount } from '../domain/supplierLedger';
import { formatBusinessDate } from '../utils/date';
import styles from '../styles/SupplierLedgerScreen.styles';
import { useBusinessConfig } from '../context/BusinessConfigContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierLedger'>;

export default function SupplierLedgerScreen({ navigation }: Props) {
  const { formatMoney } = useBusinessConfig();
  const [accounts, setAccounts] = useState<SupplierLedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(true);
  const [expandedSupplierId, setExpandedSupplierId] = useState<number | null>(null);

  const loadLedger = async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setAccounts(await getSupplierPaymentLedger());
    } catch (error) {
      console.error('Unable to load supplier ledger:', error);
      Alert.alert('Unable to load ledger', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accounts.filter((account) =>
      (!outstandingOnly || account.balanceDue > 0)
      && (!query || account.supplierName.toLowerCase().includes(query)),
    );
  }, [accounts, outstandingOnly, search]);

  const totals = useMemo(() => accounts.reduce((sum, account) => ({
    billed: sum.billed + account.totalBilled,
    paid: sum.paid + account.totalPaid,
    due: sum.due + account.balanceDue,
  }), { billed: 0, paid: 0, due: 0 }), [accounts]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Supplier Ledger</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.summaryCard}>
        <View><Text style={styles.summaryLabel}>Billed</Text><Text style={styles.summaryValue}>{formatMoney(totals.billed, 0)}</Text></View>
        <View><Text style={styles.summaryLabel}>Paid</Text><Text style={styles.summaryPaid}>{formatMoney(totals.paid, 0)}</Text></View>
        <View><Text style={styles.summaryLabel}>Outstanding</Text><Text style={styles.summaryDue}>{formatMoney(totals.due, 0)}</Text></View>
      </View>

      <View style={styles.filters}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search supplier"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={[styles.filterChip, outstandingOnly && styles.filterChipActive]}
          onPress={() => setOutstandingOnly((value) => !value)}
        >
          <Text style={[styles.filterText, outstandingOnly && styles.filterTextActive]}>Outstanding only</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLedger(true)} />}
      >
        {visibleAccounts.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>No matching supplier accounts</Text></View>
        ) : visibleAccounts.map((account) => {
          const expanded = expandedSupplierId === account.supplierId;
          return (
            <View key={account.supplierId} style={styles.accountCard}>
              <TouchableOpacity
                style={styles.accountHeader}
                onPress={() => setExpandedSupplierId(expanded ? null : account.supplierId)}
              >
                <View style={styles.accountNameWrap}>
                  <Text style={styles.accountName}>{account.supplierName}</Text>
                  <Text style={styles.accountMeta}>Paid {formatMoney(account.totalPaid, 0)} of {formatMoney(account.totalBilled, 0)}</Text>
                </View>
                <View style={styles.accountDueWrap}>
                  <Text style={styles.accountDue}>{formatMoney(account.balanceDue, 0)}</Text>
                  <Text style={styles.dueLabel}>due {expanded ? '⌃' : '⌄'}</Text>
                </View>
              </TouchableOpacity>

              {expanded ? (
                <View style={styles.entries}>
                  {account.entries.map((entry) => (
                    <TouchableOpacity
                      key={entry.key}
                      style={[styles.entry, entry.type === 'voided_payment' && styles.voidedEntry]}
                      disabled={!entry.billId}
                      onPress={() => {
                        if (entry.billId) navigation.navigate('PurchaseBillDetails', { billId: entry.billId });
                      }}
                    >
                      <View style={styles.entryLeft}>
                        <Text style={styles.entryTitle}>
                          {entry.type === 'bill' ? entry.billNumber : entry.type === 'payment' ? 'Payment' : 'Voided payment'}
                        </Text>
                        <Text style={styles.entryMeta}>
                          {formatBusinessDate(entry.date)}
                          {entry.paymentMode ? ` · ${entry.paymentMode.replace('_', ' ').toUpperCase()}` : ''}
                          {entry.referenceNumber ? ` · ${entry.referenceNumber}` : ''}
                        </Text>
                      </View>
                      <View style={styles.entryRight}>
                        <Text style={entry.type === 'bill' ? styles.billAmount : entry.type === 'payment' ? styles.paidAmount : styles.voidedAmount}>
                          {entry.type === 'bill' ? '+' : entry.type === 'payment' ? '−' : ''}{formatMoney(entry.amount, 0)}
                        </Text>
                        <Text style={styles.runningBalance}>Balance {formatMoney(entry.balanceAfter, 0)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
