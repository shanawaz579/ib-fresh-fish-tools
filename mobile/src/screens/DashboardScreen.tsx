import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  getFishVarieties,
  getPurchasesByDate,
  getSalesByDate,
} from '../api/stock';
import type { Purchase, Sale, FishVariety } from '../types';
import { useAuth } from '../context/AuthContext';

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
    purchaseIn: 'Purchase (In)',
    salesOut: 'Sales (Out)',
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

// Hardcoded order for fish varieties (matching web)
const VARIETY_ORDER = ['Pangasius', 'Roopchand', 'Rohu', 'Katla', 'Tilapia', 'Silver Carp', 'Grass Carp', 'Common Carp'];
const SIZE_ORDER = ['Big', 'Medium', 'Small'];

// Helper function to extract size from variety name
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

// Helper function to get variety sort key
function getVarietySortKey(varietyName: string): number {
  // Extract base variety name and size
  let baseVariety = varietyName;
  let size = '';

  for (const s of SIZE_ORDER) {
    if (varietyName.includes(s)) {
      size = s;
      baseVariety = varietyName.replace(s, '').trim();
      break;
    }
  }

  const varietyIndex = VARIETY_ORDER.indexOf(baseVariety);
  const sizeIndex = SIZE_ORDER.indexOf(size);

  // If variety not found, put it at the end
  if (varietyIndex === -1) return 9999;

  // If size not found, treat as first (0)
  const finalSizeIndex = sizeIndex === -1 ? 0 : sizeIndex;

  // Create composite key: variety * 10 + size
  return varietyIndex * 10 + finalSizeIndex;
}

export default function DashboardScreen() {
  const { user, isAdmin, signOut } = useAuth();
  const [language, setLanguage] = useState<Language>('en');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
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

    const [purchasesData, salesData, varietiesData] = await Promise.all([
      getPurchasesByDate(date),
      getSalesByDate(date),
      getFishVarieties(),
    ]);

    setPurchases(purchasesData);
    setSales(salesData);
    setVarieties(varietiesData);

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

  // Calculate stock summary
  const stockSummary: StockSummary[] = varieties
    .map((variety) => {
      const purchased = purchases
        .filter((p) => p.fish_variety_id === variety.id)
        .reduce(
          (sum, p) => ({
            crates: sum.crates + p.quantity_crates,
            kg: sum.kg + p.quantity_kg,
          }),
          { crates: 0, kg: 0 }
        );

      const sold = sales
        .filter((s) => s.fish_variety_id === variety.id)
        .reduce(
          (sum, s) => ({
            crates: sum.crates + s.quantity_crates,
            kg: sum.kg + s.quantity_kg,
          }),
          { crates: 0, kg: 0 }
        );

      return {
        varietyId: variety.id,
        varietyName: variety.name,
        purchased,
        sold,
        balance: {
          crates: purchased.crates - sold.crates,
          kg: purchased.kg - sold.kg,
        },
      };
    })
    .filter((item) => item.purchased.crates > 0 || item.purchased.kg > 0)
    .sort((a, b) => getVarietySortKey(a.varietyName) - getVarietySortKey(b.varietyName));

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
    if (balance.crates < 0) return 'critical';
    if (balance.crates < 10) return 'low';
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

  // Sort customers by total crates descending
  customerSalesGroups.sort((a, b) => b.totalCrates - a.totalCrates);

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
                    const { name, size } = extractSizeAndName(item.varietyName);
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
                                {sale.quantity_crates > 0 && sale.quantity_kg > 0 && ' + '}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#3B82F6',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#DBEAFE',
  },
  languageButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  languageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  },
  loader: {
    marginTop: 32,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'stretch',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderBottomWidth: 3,
    justifyContent: 'space-between',
    minHeight: 90,
  },
  purchaseCard: {
    borderBottomColor: '#10B981',
  },
  salesCard: {
    borderBottomColor: '#F59E0B',
  },
  balanceCard: {
    borderBottomColor: '#3B82F6',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  summarySubValue: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  negativeValue: {
    color: '#DC2626',
  },
  positiveValue: {
    color: '#10B981',
  },
  salesColor: {
    color: '#F59E0B',
  },
  balanceColor: {
    color: '#3B82F6',
  },
  balanceNumber: {
    fontWeight: 'bold',
  },
  balancePositive: {
    color: '#10B981',
  },
  balanceNegative: {
    color: '#DC2626',
  },
  balanceTotal: {
    color: '#6B7280',
    fontWeight: 'normal',
  },
  stockOverviewContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 16,
    paddingVertical: 32,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderRight: {
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  criticalRow: {
    backgroundColor: '#FEE2E2',
  },
  lowRow: {
    backgroundColor: '#FEF3C7',
  },
  fishColumn: {
    flex: 2.5,
    justifyContent: 'center',
    paddingRight: 16,
  },
  dataColumn: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  fishNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fishName: {
    fontSize: 13,
    fontWeight: '600',
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
  dataValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
  },
  dataSubValue: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'right',
  },
  salesDetailsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 32,
  },
  salesDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  customersBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  customersBadgeText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '600',
  },
  customerCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  customerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  customerCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  collapseIcon: {
    fontSize: 10,
    color: '#6B7280',
    width: 12,
    flexShrink: 0,
  },
  customerCardNameContainer: {
    flex: 1,
    minWidth: 0,
  },
  customerCardName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  customerCardSubtext: {
    fontSize: 11,
    color: '#6B7280',
  },
  customerCardHeaderRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    flexShrink: 0,
    minWidth: 60,
  },
  customerCardTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  customerCardTotalKg: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  customerCardBody: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  saleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  saleItemRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 12,
  },
  saleItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  saleItemQuantity: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
});
