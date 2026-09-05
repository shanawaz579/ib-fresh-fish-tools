import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DayCloseHomeCard from '../features/cashbook/DayCloseHomeCard';
import { useTodayCloseStatus } from '../features/cashbook/useTodayCloseStatus';
import HomeActionCard from '../features/home/HomeActionCard';
import HomeInventoryOverview from '../features/home/HomeInventoryOverview';
import { useAuth } from '../context/AuthContext';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/HomeScreen.styles';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

type SecondaryRowProps = {
  icon: string;
  label: string;
  hint: string;
  last?: boolean;
  onPress: () => void;
};

function SecondaryRow({ icon, label, hint, last, onPress }: SecondaryRowProps) {
  return (
    <TouchableOpacity style={[styles.secondaryRow, last && styles.secondaryRowLast]} onPress={onPress}>
      <Text style={styles.secondaryIcon}>{icon}</Text>
      <View style={styles.secondaryCopy}>
        <Text style={styles.secondaryLabel}>{label}</Text>
        <Text style={styles.secondaryHint}>{hint}</Text>
      </View>
      <Text style={styles.secondaryArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const { configuration } = useBusinessConfig();
  const { profile, preferences } = configuration;
  const { enabled_modules: modules, terminology } = preferences;
  const todayCloseStatus = useTodayCloseStatus();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = () => Alert.alert('Logout', 'Are you sure you want to logout?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Logout', style: 'destructive', onPress: () => signOut() },
  ]);

  const hasDailyWork = modules.purchases || modules.sales || modules.packing;
  const hasAccounts = modules.customer_billing || modules.supplier_billing || modules.expenses;
  const hasOverview = modules.inventory || modules.customer_billing || modules.supplier_billing || modules.cashbook;
  const hasReports = modules.sales || modules.purchases || modules.customer_billing || modules.supplier_billing || modules.profitability;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: profile.primary_color }]}>
        <View>
          <Text style={styles.businessName}>{profile.display_name}</Text>
          <Text style={styles.tagline}>{profile.tagline}</Text>
        </View>
        <TouchableOpacity accessibilityLabel="Logout" style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>↪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {modules.inventory ? <HomeInventoryOverview onPress={() => navigation.navigate('Dashboard')} /> : null}
        {modules.cashbook ? <DayCloseHomeCard readiness={todayCloseStatus} onPress={() => navigation.navigate('Cashbook')} /> : null}

        {hasDailyWork ? <View style={[styles.section, styles.firstSection]}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Daily work</Text><Text style={styles.sectionHint}>Record today’s activity</Text></View>
          <View style={styles.actionGrid}>
            {modules.sales ? <HomeActionCard icon="↑" title="Sales" subtitle="Sell stock to customers" color="#2563EB" onPress={() => navigation.navigate('Sales')} /> : null}
            {modules.purchases ? <HomeActionCard icon="↓" title="Purchases" subtitle="Record incoming stock" color="#059669" onPress={() => navigation.navigate('Purchase')} /> : null}
            {modules.packing ? <HomeActionCard icon="✓" title="Packing" subtitle="Prepare and load orders" color="#D97706" onPress={() => navigation.navigate('Packing')} /> : null}
          </View>
        </View> : null}

        {hasAccounts ? <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Accounts</Text><Text style={styles.sectionHint}>Bills, balances and payments</Text></View>
          <View style={styles.actionGrid}>
            {modules.customer_billing ? <HomeActionCard icon="₹" title={`${terminology.customer} Accounts`} subtitle="Bills and money received" color="#0F766E" onPress={() => navigation.navigate('Payments')} /> : null}
            {modules.supplier_billing ? <HomeActionCard icon="₹" title={`${terminology.supplier} Accounts`} subtitle="Bills and money paid" color="#7C3AED" onPress={() => navigation.navigate('SupplierLedger')} /> : null}
            {modules.expenses ? <HomeActionCard icon="−" title="Expenses" subtitle="Record operating costs" color="#C2410C" onPress={() => navigation.navigate('Expenses')} /> : null}
          </View>
        </View> : null}

        {hasOverview ? <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Overview</Text><Text style={styles.sectionHint}>Monitor the business</Text></View>
          <View style={styles.actionGrid}>
            {modules.inventory ? <HomeActionCard icon="≡" title="Inventory" subtitle="Stock and movement ledger" color="#0891B2" onPress={() => navigation.navigate('StockLedger')} /> : null}
            {(modules.customer_billing || modules.supplier_billing) ? <HomeActionCard icon="⇅" title="Payments" subtitle="All receipts and payments" color="#4338CA" onPress={() => navigation.navigate('PaymentRegister')} /> : null}
            {modules.cashbook ? <HomeActionCard icon="₹" title="Cashbook" subtitle="Physical cash and day close" color="#334155" onPress={() => navigation.navigate('Cashbook')} /> : null}
          </View>
        </View> : null}

        <TouchableOpacity style={styles.moreButton} onPress={() => setMoreOpen(value => !value)}>
          <View><Text style={styles.moreTitle}>More</Text><Text style={styles.moreSubtitle}>Reports, bill history and setup</Text></View>
          <Text style={styles.moreChevron}>{moreOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {moreOpen ? <>
          {hasReports ? <View style={styles.secondarySection}>
            <Text style={styles.secondaryTitle}>REPORTS & HISTORY</Text>
            <View style={styles.secondaryGrid}>
              {(modules.sales || modules.purchases) ? <SecondaryRow icon="⌕" label="Item activity" hint="Items by customer or supplier" onPress={() => navigation.navigate('ItemsByCustomer')} /> : null}
              {modules.customer_billing ? <SecondaryRow icon="▤" label="Sales bill history" hint="Find and correct customer bills" last={!modules.supplier_billing && !modules.profitability} onPress={() => navigation.navigate('BillsView')} /> : null}
              {modules.supplier_billing ? <SecondaryRow icon="▤" label="Purchase bill history" hint="Review supplier bills" last={!modules.profitability} onPress={() => navigation.navigate('PurchaseBillsView')} /> : null}
              {modules.profitability ? <SecondaryRow icon="↗" label="Profitability" hint="Revenue, costs and profit" last onPress={() => navigation.navigate('Profitability')} /> : null}
            </View>
          </View> : null}

          <View style={styles.secondarySection}>
            <Text style={styles.secondaryTitle}>SETUP</Text>
            <View style={styles.secondaryGrid}>
              <SecondaryRow icon="S" label={`${terminology.supplier}s`} hint="Manage suppliers and mediators" onPress={() => navigation.navigate('Farmers')} />
              <SecondaryRow icon="C" label={`${terminology.customer}s`} hint="Manage customer accounts" onPress={() => navigation.navigate('Customers')} />
              <SecondaryRow icon="I" label={`${terminology.item} catalog`} hint="Manage items, grades and units" onPress={() => navigation.navigate('FishVarieties')} />
              <SecondaryRow icon="⚙" label="Business settings" hint="Configure this installation" last onPress={() => navigation.navigate('BusinessSettings')} />
            </View>
          </View>
        </> : null}

        <View style={styles.footer}><Text style={styles.footerText}>VERSION 1.0.0</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}
