import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import PurchaseScreen from '../screens/PurchaseScreen';
import SalesScreen from '../screens/SalesScreen';
import HomeScreen from '../screens/HomeScreen';
import FarmersScreen from '../screens/FarmersScreen';
import CustomersScreen from '../screens/CustomersScreen';
import FishVarietiesScreen from '../screens/FishVarietiesScreen';
import DashboardScreen from '../screens/DashboardScreen';
import BillGenerationScreen from '../screens/BillGenerationScreen';
import PackingScreen from '../screens/PackingScreen';
import ItemsByCustomerScreen from '../screens/ItemsByCustomerScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import BillsViewScreen from '../screens/BillsViewScreen';
import PurchaseBillGenerationScreen from '../screens/PurchaseBillGenerationScreen';
import PurchaseBillsViewScreen from '../screens/PurchaseBillsViewScreen';
import PurchaseBillDetailsScreen from '../screens/PurchaseBillDetailsScreen';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Dashboard: undefined;
  Packing: undefined;
  ItemsByCustomer: undefined;
  Purchase: undefined;
  Sales: undefined;
  Farmers: undefined;
  Customers: undefined;
  FishVarieties: undefined;
  BillGeneration: undefined;
  PurchaseBillGeneration: {
    farmer_id: number;
    farmer_name: string;
    farmer_location?: string;
    farmer_secondary_name?: string;
    purchases: any[];
    date: string;
  };
  Payments: undefined;
  BillsView: undefined;
  PurchaseBillsView: undefined;
  PurchaseBillDetails: {
    billId: number;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function Navigation() {
  const { session, loading, isAdmin, isPacker } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  // Determine initial route based on user role
  const getInitialRoute = () => {
    if (!session) return 'Login';
    if (isAdmin) return 'Home';
    if (isPacker) return 'Packing';
    return 'Dashboard';
  };

  return (
    <Stack.Navigator
      initialRouteName={getInitialRoute()}
      screenOptions={{
        headerShown: false,
      }}
    >
      {!session ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : isAdmin ? (
        // Admin users get all screens including Packing
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Packing" component={PackingScreen} />
          <Stack.Screen name="ItemsByCustomer" component={ItemsByCustomerScreen} />
          <Stack.Screen name="Purchase" component={PurchaseScreen} />
          <Stack.Screen name="Sales" component={SalesScreen} />
          <Stack.Screen name="BillGeneration" component={BillGenerationScreen} />
          <Stack.Screen name="PurchaseBillGeneration" component={PurchaseBillGenerationScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="BillsView" component={BillsViewScreen} />
          <Stack.Screen name="PurchaseBillsView" component={PurchaseBillsViewScreen} />
          <Stack.Screen name="PurchaseBillDetails" component={PurchaseBillDetailsScreen} />
          <Stack.Screen name="Farmers" component={FarmersScreen} />
          <Stack.Screen name="Customers" component={CustomersScreen} />
          <Stack.Screen name="FishVarieties" component={FishVarietiesScreen} />
        </>
      ) : isPacker ? (
        // Packer users only get Packing screen
        <Stack.Screen name="Packing" component={PackingScreen} />
      ) : (
        // Viewer users only get Dashboard
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Navigation />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0EA5E9',
  },
});
