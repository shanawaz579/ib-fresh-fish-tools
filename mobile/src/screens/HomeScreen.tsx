import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import DayCloseHomeCard from '../features/cashbook/DayCloseHomeCard';
import { useTodayCloseStatus } from '../features/cashbook/useTodayCloseStatus';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { signOut, user } = useAuth();
  const { configuration } = useBusinessConfig();
  const { profile, preferences } = configuration;
  const todayCloseStatus = useTodayCloseStatus();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: profile.primary_color }]}>
        <View>
          <Text style={styles.title}>{profile.display_name}</Text>
          <Text style={styles.subtitle}>{profile.tagline}</Text>
          {user?.email && <Text style={styles.userEmail}>{user.email}</Text>}
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.menuContainer} contentContainerStyle={styles.menuContent}>
        {preferences.enabled_modules.cashbook ? <DayCloseHomeCard readiness={todayCloseStatus} onPress={() => navigation.navigate('Cashbook')} /> : null}
        {preferences.enabled_modules.inventory ? (
          <>
            <TouchableOpacity
              style={[styles.heroCard, styles.dashboardCard]}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Text style={styles.heroIcon}>📈</Text>
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>Stock Dashboard</Text>
                <Text style={styles.heroDescription}>View current inventory & stock levels</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroCard, styles.stockLedgerCard]}
              onPress={() => navigation.navigate('StockLedger')}
            >
              <Text style={styles.heroIcon}>🧊</Text>
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>Stock Ledger</Text>
                <Text style={styles.heroDescription}>Opening, inward, outward, closing & reconciliation</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {/* Sales Section */}
        {(preferences.enabled_modules.sales
          || preferences.enabled_modules.packing
          || preferences.enabled_modules.customer_billing) ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sales Operations</Text>
          </View>
        ) : null}

        <View style={styles.gridContainer}>
          {preferences.enabled_modules.sales ? <TouchableOpacity
            style={[styles.gridCard, styles.salesCard]}
            onPress={() => navigation.navigate('Sales')}
          >
            <Text style={styles.gridIcon}>📊</Text>
            <Text style={styles.gridTitle}>Sales Entry</Text>
          </TouchableOpacity> : null}

          {preferences.enabled_modules.packing ? <TouchableOpacity
            style={[styles.gridCard, styles.packingCard]}
            onPress={() => navigation.navigate('Packing')}
          >
            <Text style={styles.gridIcon}>📦</Text>
            <Text style={styles.gridTitle}>Packing</Text>
          </TouchableOpacity> : null}

          {preferences.enabled_modules.sales ? <TouchableOpacity
            style={[styles.gridCard, styles.itemsByCustomerCard]}
            onPress={() => navigation.navigate('ItemsByCustomer')}
          >
            <Text style={styles.gridIcon}>📋</Text>
            <Text style={styles.gridTitle}>{preferences.terminology.item}s by {preferences.terminology.customer}</Text>
          </TouchableOpacity> : null}

          {preferences.enabled_modules.customer_billing ? <TouchableOpacity
            style={[styles.gridCard, styles.billCard]}
            onPress={() => navigation.navigate('BillGeneration')}
          >
            <Text style={styles.gridIcon}>🧾</Text>
            <Text style={styles.gridTitle}>Generate Bill</Text>
          </TouchableOpacity> : null}

          {preferences.enabled_modules.customer_billing ? <TouchableOpacity
            style={[styles.gridCard, styles.billsViewCard]}
            onPress={() => navigation.navigate('BillsView')}
          >
            <Text style={styles.gridIcon}>📄</Text>
            <Text style={styles.gridTitle}>View Bills</Text>
          </TouchableOpacity> : null}

          {preferences.enabled_modules.customer_billing ? <TouchableOpacity
            style={[styles.gridCard, styles.paymentsCard]}
            onPress={() => navigation.navigate('Payments')}
          >
            <Text style={styles.gridIcon}>💰</Text>
            <Text style={styles.gridTitle}>Payments</Text>
          </TouchableOpacity> : null}
        </View>

        {/* Purchase Section */}
        {(preferences.enabled_modules.purchases || preferences.enabled_modules.supplier_billing) ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Purchase Operations</Text>
          </View>
        ) : null}

        <View style={styles.gridContainer}>
          {preferences.enabled_modules.purchases ? <TouchableOpacity
            style={[styles.gridCard, styles.purchaseCard]}
            onPress={() => navigation.navigate('Purchase')}
          >
            <Text style={styles.gridIcon}>🛒</Text>
            <Text style={styles.gridTitle}>Purchase Entry</Text>
          </TouchableOpacity> : null}

          {preferences.enabled_modules.supplier_billing ? <TouchableOpacity
            style={[styles.gridCard, styles.purchaseBillsViewCard]}
            onPress={() => navigation.navigate('PurchaseBillsView')}
          >
            <Text style={styles.gridIcon}>📋</Text>
            <Text style={styles.gridTitle}>Purchase Bills</Text>
          </TouchableOpacity> : null}

          {preferences.enabled_modules.supplier_billing ? <TouchableOpacity
            style={[styles.gridCard, styles.paymentsCard]}
            onPress={() => navigation.navigate('SupplierLedger')}
          >
            <Text style={styles.gridIcon}>💳</Text>
            <Text style={styles.gridTitle}>{preferences.terminology.supplier} Ledger</Text>
          </TouchableOpacity> : null}
        </View>

        {(preferences.enabled_modules.expenses || preferences.enabled_modules.cashbook || preferences.enabled_modules.profitability) ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Finance</Text>
            </View>
            <View style={styles.gridContainer}>
              {preferences.enabled_modules.expenses ? <TouchableOpacity
                style={[styles.gridCard, styles.expensesCard]}
                onPress={() => navigation.navigate('Expenses')}
              >
                <Text style={styles.gridIcon}>🧮</Text>
                <Text style={styles.gridTitle}>Expenses</Text>
              </TouchableOpacity> : null}
              {preferences.enabled_modules.cashbook ? <TouchableOpacity
                style={[styles.gridCard, styles.cashbookCard]}
                onPress={() => navigation.navigate('Cashbook')}
              >
                <Text style={styles.gridIcon}>💵</Text>
                <Text style={styles.gridTitle}>Cashbook</Text>
              </TouchableOpacity> : null}
              {preferences.enabled_modules.profitability ? <TouchableOpacity
                style={[styles.gridCard, styles.profitabilityCard]}
                onPress={() => navigation.navigate('Profitability')}
              >
                <Text style={styles.gridIcon}>📈</Text>
                <Text style={styles.gridTitle}>Profitability</Text>
              </TouchableOpacity> : null}
            </View>
          </>
        ) : null}

        {/* Management Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Master Data</Text>
        </View>

        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={[styles.gridCard, styles.farmersCard]}
            onPress={() => navigation.navigate('Farmers')}
          >
            <Text style={styles.gridIcon}>👨‍🌾</Text>
            <Text style={styles.gridTitle}>{preferences.terminology.supplier}s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.customersCard]}
            onPress={() => navigation.navigate('Customers')}
          >
            <Text style={styles.gridIcon}>🏢</Text>
            <Text style={styles.gridTitle}>{preferences.terminology.customer}s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.varietiesCard]}
            onPress={() => navigation.navigate('FishVarieties')}
          >
            <Text style={styles.gridIcon}>🐟</Text>
            <Text style={styles.gridTitle}>{preferences.terminology.item} Catalog</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.settingsCard]}
            onPress={() => navigation.navigate('BusinessSettings')}
          >
            <Text style={styles.gridIcon}>⚙️</Text>
            <Text style={styles.gridTitle}>Business Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Version 1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: '#0EA5E9',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E0F2FE',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#BAE6FD',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuContainer: {
    flex: 1,
  },
  menuContent: {
    padding: 16,
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderLeftWidth: 6,
  },
  heroIcon: {
    fontSize: 48,
    marginRight: 20,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  heroDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  dashboardCard: {
    borderLeftColor: '#8B5CF6',
  },
  stockLedgerCard: {
    borderLeftColor: '#0F766E',
  },
  packingCard: {
    borderBottomColor: '#0EA5E9',
  },
  itemsByCustomerCard: {
    borderBottomColor: '#6366F1',
  },
  purchaseCard: {
    borderBottomColor: '#10B981',
  },
  salesCard: {
    borderBottomColor: '#3B82F6',
  },
  billCard: {
    borderBottomColor: '#F59E0B',
  },
  paymentsCard: {
    borderBottomColor: '#10B981',
  },
  billsViewCard: {
    borderBottomColor: '#6366F1',
  },
  purchaseBillsViewCard: {
    borderBottomColor: '#059669',
  },
  farmersCard: {
    borderBottomColor: '#F59E0B',
  },
  customersCard: {
    borderBottomColor: '#8B5CF6',
  },
  varietiesCard: {
    borderBottomColor: '#EC4899',
  },
  settingsCard: {
    borderBottomColor: '#0F766E',
  },
  expensesCard: {
    borderBottomColor: '#C2410C',
  },
  cashbookCard: {
    borderBottomColor: '#334155',
  },
  profitabilityCard: {
    borderBottomColor: '#7C3AED',
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0EA5E9',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '31%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderBottomWidth: 4,
    marginBottom: 12,
  },
  gridIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
