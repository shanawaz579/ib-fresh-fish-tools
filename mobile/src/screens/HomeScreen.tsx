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
        {/* 1. Stock Dashboard */}
        <TouchableOpacity
          style={[styles.menuCard, styles.dashboardCard]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.icon}>📈</Text>
          <Text style={styles.menuTitle}>Stock Dashboard</Text>
        </TouchableOpacity>

        {/* 2. Sales */}
        <TouchableOpacity
          style={[styles.menuCard, styles.salesCard]}
          onPress={() => navigation.navigate('Sales')}
        >
          <Text style={styles.icon}>📊</Text>
          <Text style={styles.menuTitle}>Sales Spreadsheet</Text>
        </TouchableOpacity>

        {/* 3. Bill Generation */}
        <TouchableOpacity
          style={[styles.menuCard, styles.billCard]}
          onPress={() => navigation.navigate('BillGeneration')}
        >
          <Text style={styles.icon}>🧾</Text>
          <Text style={styles.menuTitle}>Bill Generation</Text>
        </TouchableOpacity>

        {/* 4. Purchase */}
        <TouchableOpacity
          style={[styles.menuCard, styles.purchaseCard]}
          onPress={() => navigation.navigate('Purchase')}
        >
          <Text style={styles.icon}>🛒</Text>
          <Text style={styles.menuTitle}>Purchase Bill</Text>
        </TouchableOpacity>

        {/* Additional Features */}
        <TouchableOpacity
          style={[styles.menuCard, styles.packingCard]}
          onPress={() => navigation.navigate('Packing')}
        >
          <Text style={styles.icon}>📦</Text>
          <Text style={styles.menuTitle}>Packing List</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuCard, styles.itemsByCustomerCard]}
          onPress={() => navigation.navigate('ItemsByCustomer')}
        >
          <Text style={styles.icon}>📋</Text>
          <Text style={styles.menuTitle}>Items by Customer</Text>
        </TouchableOpacity>

        {/* Management Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Manage</Text>
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
            <Text style={styles.gridTitle}>Fish Varieties</Text>
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
    paddingBottom: 32,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 5,
  },
  dashboardCard: {
    borderLeftColor: '#8B5CF6',
  },
  packingCard: {
    borderLeftColor: '#0EA5E9',
  },
  itemsByCustomerCard: {
    borderLeftColor: '#6366F1',
  },
  purchaseCard: {
    borderLeftColor: '#10B981',
  },
  salesCard: {
    borderLeftColor: '#3B82F6',
  },
  billCard: {
    borderLeftColor: '#F59E0B',
  },
  farmersCard: {
    borderLeftColor: '#F59E0B',
  },
  customersCard: {
    borderLeftColor: '#8B5CF6',
  },
  varietiesCard: {
    borderLeftColor: '#EC4899',
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0EA5E9',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  icon: {
    fontSize: 36,
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  menuDescription: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '30%',
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
    fontSize: 32,
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 13,
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
