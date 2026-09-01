import styles from '../styles/DashboardScreen.styles';
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
import {
  getSalesByDate,
  getCustomers,
  getStockSnapshot,
} from '../api/stock';
import type { Sale, Customer } from '../types';
import type { StockSnapshot } from '../domain/stockLedger';
import { useAuth } from '../context/AuthContext';
import DateNavigator from '../components/DateNavigator';
import { extractFishSize, getFishVarietySortKey, getTotalWeightKg } from '../domain/fish';
import { useBusinessDate } from '../hooks/useBusinessDate';

type Language = 'en' | 'te';

interface StockSummary {
  varietyId: number;
  varietyName: string;
  purchased: { crates: number; kg: number };
  sold: { crates: number; kg: number };
  balance: { crates: number; kg: number };
}

interface CustomerSalesGroup {
  customerId: number;
  customerName: string;
  sales: Sale[];
  totalCrates: number;
  totalKg: number;
}

const translations = {
  en: {
    title: 'Stock Dashboard',
    fish: 'Fish',
    sales: 'Sales',
    availableTotal: 'Available/Total',
    purchaseIn: 'Inward',
    salesOut: 'Outward',
    balance: 'Balance',
    crates: 'Crates',
    cr: 'cr',
    kg: 'Kg',
    noStock: 'No stock data for today',
    totalPurchases: 'Total Purchases',
    totalSales: 'Total Sales',
    netBalance: 'Net Balance',
    stockOverview: 'Stock Overview',
    criticalStock: 'Critical Stock',
    lowStock: 'Low Stock',
    goodStock: 'Good Stock',
    salesDetails: 'Sales Details',
    customersServed: 'Customers Served',
    noSales: 'No sales recorded today',
    varieties: 'varieties',
  },
  te: {
    title: 'స్టాక్ డాష్‌బోర్డ్',
    fish: 'చేప',
    sales: 'అమ్మకాలు',
    availableTotal: 'అందుబాటులో/మొత్తం',
    purchaseIn: 'కొనుగోలు (లోపలికి)',
    salesOut: 'అమ్మకాలు (బయటకు)',
    balance: 'బ్యాలెన్స్',
    crates: 'క్రేట్లు',
    cr: 'క్రే',
    kg: 'కేజీ',
    noStock: 'ఈరోజు స్టాక్ డేటా లేదు',
    totalPurchases: 'మొత్తం కొనుగోలు',
    totalSales: 'మొత్తం అమ్మకాలు',
    netBalance: 'నికర బ్యాలెన్స్',
    stockOverview: 'స్టాక్ సమీక్ష',
    criticalStock: 'క్రిటికల్ స్టాక్',
    lowStock: 'తక్కువ స్టాక్',
    goodStock: 'మంచి స్టాక్',
    salesDetails: 'అమ్మకాల వివరాలు',
    customersServed: 'సేవలందిన కస్టమర్లు',
    noSales: 'ఈరోజు అమ్మకాలు నమోదు చేయబడలేదు',
    varieties: 'రకాలు',
  },
};

export default function DashboardScreen() {
  const { user, isAdmin, signOut } = useAuth();
  const [language, setLanguage] = useState<Language>('en');
  const { date, goToPreviousDay, goToNextDay, goToToday } = useBusinessDate();
  const [stockSnapshot, setStockSnapshot] = useState<StockSnapshot[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCustomers, setCollapsedCustomers] = useState<Set<number>>(new Set());

  const t = translations[language];

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

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [snapshotData, salesData, customersData] = await Promise.all([
      getStockSnapshot(date),
      getSalesByDate(date),
      getCustomers(),
    ]);

    setStockSnapshot(snapshotData);
    setSales(salesData);
    setCustomers(customersData);

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'te' : 'en');
  };

  // Calculate stock summary
  const stockSummary: StockSummary[] = stockSnapshot
    .map((snapshot) => ({
      varietyId: snapshot.itemVariantId,
      varietyName: snapshot.variantName,
      purchased: { crates: snapshot.inwardCrates, kg: snapshot.inwardKg },
      sold: { crates: snapshot.outwardCrates, kg: snapshot.outwardKg },
      balance: { crates: snapshot.closingCrates, kg: snapshot.closingKg },
    }))
    .sort((a, b) => getFishVarietySortKey(a.varietyName) - getFishVarietySortKey(b.varietyName));

  // Calculate totals
  const totals = stockSummary.reduce(
    (sum, item) => ({
      purchasedCrates: sum.purchasedCrates + item.purchased.crates,
      purchasedKg: sum.purchasedKg + item.purchased.kg,
      soldCrates: sum.soldCrates + item.sold.crates,
      soldKg: sum.soldKg + item.sold.kg,
      balanceCrates: sum.balanceCrates + item.balance.crates,
      balanceKg: sum.balanceKg + item.balance.kg,
    }),
    {
      purchasedCrates: 0,
      purchasedKg: 0,
      soldCrates: 0,
      soldKg: 0,
      balanceCrates: 0,
      balanceKg: 0,
    }
  );

  const getStockStatus = (balance: { crates: number; kg: number }) => {
    if (balance.crates < 0 || balance.kg < 0) return 'critical';
    if (balance.crates === 0 && balance.kg === 0) return 'critical';
    if ((balance.crates > 0 && balance.crates < 10) || (balance.kg > 0 && balance.kg < 50)) return 'low';
    return 'good';
  };

  // Group sales by customer
  const customerSalesGroups: CustomerSalesGroup[] = sales.reduce((acc, sale) => {
    const existingGroup = acc.find(g => g.customerId === sale.customer_id);

    if (existingGroup) {
      existingGroup.sales.push(sale);
      existingGroup.totalCrates += sale.quantity_crates;
      existingGroup.totalKg += sale.quantity_kg;
    } else {
      acc.push({
        customerId: sale.customer_id,
        customerName: sale.customer_name || 'Unknown',
        sales: [sale],
        totalCrates: sale.quantity_crates,
        totalKg: sale.quantity_kg,
      });
    }

    return acc;
  }, [] as CustomerSalesGroup[]);

  // Sort customers: Wholesale Market first, then others, both sorted by total quantity descending
  customerSalesGroups.sort((a, b) => {
    const customerA = customers.find(c => c.id === a.customerId);
    const customerB = customers.find(c => c.id === b.customerId);

    const isWholesaleA = customerA?.business_type === 'Wholesale Market';
    const isWholesaleB = customerB?.business_type === 'Wholesale Market';

    // Wholesale Market customers come first
    if (isWholesaleA && !isWholesaleB) return -1;
    if (!isWholesaleA && isWholesaleB) return 1;

    // Within each group, sort by total weight (crates * 35 + kg) descending
    const weightA = getTotalWeightKg(a.totalCrates, a.totalKg);
    const weightB = getTotalWeightKg(b.totalCrates, b.totalKg);

    return weightB - weightA;
  });

  const toggleCustomerCollapse = (customerId: number) => {
    setCollapsedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{t.title}</Text>
          {!isAdmin && user?.email && (
            <Text style={styles.userEmail}>{user.email}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleLanguage} style={styles.languageButton}>
            <Text style={styles.languageButtonText}>{language === 'en' ? 'తెలుగు' : 'English'}</Text>
          </TouchableOpacity>
          {!isAdmin && (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <DateNavigator date={date} onPrevious={goToPreviousDay} onNext={goToNextDay} onToday={goToToday} />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} tintColor="#3B82F6" />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={[styles.summaryCard, styles.salesCard]}>
                <Text style={styles.summaryLabel}>{t.totalSales}</Text>
                <Text style={styles.summaryValue}>{totals.soldCrates}</Text>
                <Text style={styles.summarySubValue}>{totals.soldKg.toFixed(1)} {t.kg}</Text>
              </View>

              <View style={[styles.summaryCard, styles.balanceCard]}>
                <Text style={styles.summaryLabel}>{t.netBalance}</Text>
                <Text style={[styles.summaryValue, totals.balanceCrates < 0 && styles.negativeValue]}>
                  {totals.balanceCrates}
                </Text>
                <Text style={styles.summarySubValue}>{totals.balanceKg.toFixed(1)} {t.kg}</Text>
              </View>
            </View>

            {/* Stock Overview */}
            <View style={styles.stockOverviewContainer}>
              <Text style={styles.sectionTitle}>{t.stockOverview}</Text>

              {stockSummary.length === 0 ? (
                <Text style={styles.emptyText}>{t.noStock}</Text>
              ) : (
                <>
                  {/* Table Header */}
                  <View style={styles.tableHeader}>
                    <View style={styles.fishColumn}>
                      <Text style={styles.tableHeaderText}>{t.fish}</Text>
                    </View>
                    <View style={styles.dataColumn}>
                      <Text style={[styles.tableHeaderText, styles.tableHeaderRight]}>Available</Text>
                    </View>
                    <View style={styles.dataColumn}>
                      <Text style={[styles.tableHeaderText, styles.tableHeaderRight]}>{t.sales}</Text>
                    </View>
                  </View>

                  {/* Table Rows */}
                  {stockSummary.map((item) => {
                    const status = getStockStatus(item.balance);
                        const { name, size } = extractFishSize(item.varietyName);
                    return (
                      <View
                        key={item.varietyId}
                        style={[
                          styles.tableRow,
                          status === 'critical' && styles.criticalRow,
                          status === 'low' && styles.lowRow,
                        ]}
                      >
                        {/* Fish Name Column */}
                        <View style={styles.fishColumn}>
                          <View style={styles.fishNameContainer}>
                            <Text style={styles.fishName}>{name}</Text>
                            {size && (
                              <View style={[
                                styles.sizeBadge,
                                size === 'OB' && styles.sizeBadgeOverBig,
                                size === 'B' && styles.sizeBadgeBig,
                                size === 'M' && styles.sizeBadgeMedium,
                                size === 'S' && styles.sizeBadgeSmall,
                              ]}>
                                <Text style={styles.sizeBadgeText}>{size}</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Available Column */}
                        <View style={styles.dataColumn}>
                          <Text style={[
                            styles.dataValue,
                            item.balance.crates < 0 ? styles.balanceNegative : styles.balancePositive,
                          ]}>
                            {item.balance.crates}
                          </Text>
                          {item.balance.kg !== 0 && (
                            <Text style={[
                              styles.dataSubValue,
                              item.balance.kg < 0 ? styles.balanceNegative : styles.balancePositive,
                            ]}>
                              {item.balance.kg} {t.kg}
                            </Text>
                          )}
                        </View>

                        {/* Sales Column */}
                        <View style={styles.dataColumn}>
                          <Text style={[styles.dataValue, styles.salesColor]}>
                            {item.sold.crates}
                          </Text>
                          {item.sold.kg > 0 && (
                            <Text style={styles.dataSubValue}>
                              {item.sold.kg} {t.kg}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            {/* Sales Details Section */}
            <View style={styles.salesDetailsContainer}>
              <View style={styles.salesDetailsHeader}>
                <Text style={styles.sectionTitle}>{t.salesDetails}</Text>
                {customerSalesGroups.length > 0 && (
                  <View style={styles.customersBadge}>
                    <Text style={styles.customersBadgeText}>
                      {customerSalesGroups.length} {t.customersServed}
                    </Text>
                  </View>
                )}
              </View>

              {customerSalesGroups.length === 0 ? (
                <Text style={styles.emptyText}>{t.noSales}</Text>
              ) : (
                customerSalesGroups.map((group) => {
                  const isCollapsed = collapsedCustomers.has(group.customerId);
                  const uniqueVarieties = new Set(group.sales.map(s => s.fish_variety_name)).size;

                  return (
                    <View key={group.customerId} style={styles.customerCard}>
                      <TouchableOpacity
                        onPress={() => toggleCustomerCollapse(group.customerId)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.customerCardHeader}>
                          <View style={styles.customerCardHeaderLeft}>
                            <Text style={styles.collapseIcon}>
                              {isCollapsed ? '▶' : '▼'}
                            </Text>
                            <View style={styles.customerCardNameContainer}>
                              <Text style={styles.customerCardName} numberOfLines={1} ellipsizeMode="tail">
                                {group.customerName}
                              </Text>
                              <Text style={styles.customerCardSubtext}>
                                {uniqueVarieties} {t.varieties} • {group.sales.length} items
                              </Text>
                            </View>
                          </View>
                          <View style={styles.customerCardHeaderRight}>
                            <Text style={styles.customerCardTotal}>
                              {group.totalCrates}
                            </Text>
                            {group.totalKg > 0 && (
                              <Text style={styles.customerCardTotalKg}>
                                {group.totalKg.toFixed(1)} {t.kg}
                              </Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>

                      {!isCollapsed && (
                        <View style={styles.customerCardBody}>
                          {group.sales.map((sale, index) => (
                            <View
                              key={sale.id}
                              style={[
                                styles.saleItemRow,
                                index === group.sales.length - 1 && styles.saleItemRowLast,
                              ]}
                            >
                              <Text style={styles.saleItemName}>{sale.fish_variety_name}</Text>
                              <Text style={styles.saleItemQuantity}>
                                {sale.quantity_crates > 0 && `${sale.quantity_crates} ${t.cr}`}
                                {sale.quantity_crates > 0 && sale.quantity_kg > 0 && ' · '}
                                {sale.quantity_kg > 0 && `${sale.quantity_kg} ${t.kg}`}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
