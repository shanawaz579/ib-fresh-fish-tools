import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getSupplierAccountLedger, getSupplierAccountOverview } from '../api/accountLedgers';
import AccountActivityList from '../components/AccountActivityList';
import AccountOverviewList from '../components/AccountOverviewList';
import DateNavigator from '../components/DateNavigator';
import { BRAND_COLORS } from '../config/brandTheme';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import type { AccountLedgerEntry, AccountOverview } from '../domain/accountLedger';
import { useBusinessDate } from '../hooks/useBusinessDate';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/SupplierLedgerScreen.styles';
import { toLocalDateString } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierLedger'>;

export default function SupplierLedgerScreen({ navigation }: Props) {
  const { formatMoney } = useBusinessConfig();
  const businessDate = useBusinessDate();
  const [accounts, setAccounts] = useState<AccountOverview[]>([]);
  const [entries, setEntries] = useState<AccountLedgerEntry[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selectedAccount = useMemo(
    () => accounts.find(account => account.accountId === selectedSupplierId) ?? null,
    [accounts, selectedSupplierId],
  );

  const loadOverview = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      setAccounts(await getSupplierAccountOverview(businessDate.date));
    } catch (error) {
      console.error('Unable to load supplier accounts:', error);
      Alert.alert('Unable to load supplier accounts', 'Please check your connection and try again.');
    } finally {
      setLoadingAccounts(false);
    }
  }, [businessDate.date]);

  const loadEntries = useCallback(async (supplierId: number) => {
    setLoadingEntries(true);
    try {
      setEntries(await getSupplierAccountLedger(supplierId, businessDate.date));
    } catch (error) {
      console.error('Unable to load supplier activity:', error);
      Alert.alert('Unable to load account activity', 'Please check your connection and try again.');
    } finally {
      setLoadingEntries(false);
    }
  }, [businessDate.date]);

  useEffect(() => {
    loadOverview();
    if (selectedSupplierId) loadEntries(selectedSupplierId);
  }, [loadEntries, loadOverview, selectedSupplierId]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setAccounts(await getSupplierAccountOverview(businessDate.date));
      if (selectedSupplierId) setEntries(await getSupplierAccountLedger(selectedSupplierId, businessDate.date));
    } catch (error) {
      console.error('Unable to refresh supplier accounts:', error);
      Alert.alert('Unable to refresh', 'Please check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>ACCOUNTS</Text><Text style={styles.title}>Supplier accounts</Text></View>
      </View>
      <DateNavigator date={businessDate.date} onPrevious={businessDate.goToPreviousDay} onNext={businessDate.goToNextDay} onToday={businessDate.goToToday} canGoNext={businessDate.date < toLocalDateString()} accentColor={BRAND_COLORS.primary} />

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND_COLORS.primary} />}>
        {selectedAccount ? (
          <>
            <TouchableOpacity style={styles.allAccountsButton} onPress={() => { setSelectedSupplierId(null); setEntries([]); }}><Text style={styles.allAccountsText}>‹ All supplier accounts</Text></TouchableOpacity>
            <View style={styles.accountCard}>
              <Text style={styles.accountName}>{selectedAccount.accountName}</Text>
              <Text style={styles.asOf}>Account position up to selected date</Text>
              <View style={styles.balanceRow}>
                <View>
                  <Text style={styles.balanceLabel}>{selectedAccount.advanceCredit > 0 ? 'ADVANCE WITH SUPPLIER' : 'AMOUNT TO PAY'}</Text>
                  <Text style={[styles.balanceValue, selectedAccount.advanceCredit > 0 && styles.creditValue]}>{formatMoney(selectedAccount.advanceCredit > 0 ? selectedAccount.advanceCredit : selectedAccount.outstandingAmount, 0)}</Text>
                </View>
                <View style={styles.totals}><Text style={styles.totalText}>Billed {formatMoney(selectedAccount.totalBilled, 0)}</Text><Text style={styles.totalText}>Paid {formatMoney(selectedAccount.totalPaid, 0)}</Text></View>
              </View>
            </View>
            <View style={styles.hint}><Text style={styles.hintText}>Tap a bill below to view it or record a supplier payment.</Text></View>
            {loadingEntries ? <Text style={styles.loadingText}>Loading account activity…</Text> : <AccountActivityList entries={entries} paymentLabel="Payment made" onOpenBill={billId => navigation.navigate('PurchaseBillDetails', { billId })} />}
          </>
        ) : (
          <AccountOverviewList accounts={accounts} loading={loadingAccounts} accountLabel="Suppliers" onSelect={supplierId => { setSelectedSupplierId(supplierId); setEntries([]); }} />
        )}
      </ScrollView>
    </View>
  );
}
