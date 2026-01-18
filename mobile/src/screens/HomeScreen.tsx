import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { signOut, user } = useAuth();

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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>IB Fresh Fish Tools</Text>
          <Text style={styles.subtitle}>Fish Trading Management</Text>
          {user?.email && <Text style={styles.userEmail}>{user.email}</Text>}
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.menuContainer} contentContainerStyle={styles.menuContent}>
        {/* Quick Access - Dashboard */}
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

        {/* Sales Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sales Operations</Text>
        </View>

        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={[styles.gridCard, styles.salesCard]}
            onPress={() => navigation.navigate('Sales')}
          >
            <Text style={styles.gridIcon}>📊</Text>
            <Text style={styles.gridTitle}>Sales Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.packingCard]}
            onPress={() => navigation.navigate('Packing')}
          >
            <Text style={styles.gridIcon}>📦</Text>
            <Text style={styles.gridTitle}>Packing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.itemsByCustomerCard]}
            onPress={() => navigation.navigate('ItemsByCustomer')}
          >
            <Text style={styles.gridIcon}>📋</Text>
            <Text style={styles.gridTitle}>Items by Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.billCard]}
            onPress={() => navigation.navigate('BillGeneration')}
          >
            <Text style={styles.gridIcon}>🧾</Text>
            <Text style={styles.gridTitle}>Generate Bill</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.billsViewCard]}
            onPress={() => navigation.navigate('BillsView')}
          >
            <Text style={styles.gridIcon}>📄</Text>
            <Text style={styles.gridTitle}>View Bills</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.paymentsCard]}
            onPress={() => navigation.navigate('Payments')}
          >
            <Text style={styles.gridIcon}>💰</Text>
            <Text style={styles.gridTitle}>Payments</Text>
          </TouchableOpacity>
        </View>

        {/* Purchase Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Purchase Operations</Text>
        </View>

        <View style={styles.gridContainer}>
          <TouchableOpacity
            style={[styles.gridCard, styles.purchaseCard]}
            onPress={() => navigation.navigate('Purchase')}
          >
            <Text style={styles.gridIcon}>🛒</Text>
            <Text style={styles.gridTitle}>Purchase Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.purchaseBillsViewCard]}
            onPress={() => navigation.navigate('PurchaseBillsView')}
          >
            <Text style={styles.gridIcon}>📋</Text>
            <Text style={styles.gridTitle}>Purchase Bills</Text>
          </TouchableOpacity>
        </View>

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
            <Text style={styles.gridTitle}>Farmers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.customersCard]}
            onPress={() => navigation.navigate('Customers')}
          >
            <Text style={styles.gridIcon}>🏢</Text>
            <Text style={styles.gridTitle}>Customers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.varietiesCard]}
            onPress={() => navigation.navigate('FishVarieties')}
          >
            <Text style={styles.gridIcon}>🐟</Text>
            <Text style={styles.gridTitle}>Fish Types</Text>
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
