import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import PurchaseEntryForm from '../features/purchases/PurchaseEntryForm';
import PurchaseGroupEditModal from '../features/purchases/PurchaseGroupEditModal';
import PurchaseGroupCard from '../features/purchases/PurchaseGroupCard';
import { usePurchaseRecords } from '../features/purchases/usePurchaseRecords';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/PurchaseScreen.styles';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PurchaseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const purchase = usePurchaseRecords();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Purchases</Text>
          <Text style={styles.subtitle}>Payable suppliers and harvest sources</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={purchase.refreshing}
            onRefresh={purchase.refresh}
            colors={['#0F766E']}
            tintColor="#0F766E"
          />
        )}
      >
        <DateNavigator
          date={purchase.date}
          onPrevious={purchase.goToPreviousDay}
          onNext={purchase.goToNextDay}
          onToday={purchase.goToToday}
          accentColor="#0F766E"
        />

        <PurchaseEntryForm
          suppliers={purchase.suppliers}
          varieties={purchase.varieties}
          frequentVarietyIds={purchase.frequentVarietyIds}
          supplierId={purchase.supplierId}
          farmerName={purchase.farmerName}
          location={purchase.location}
          fishVarietyId={purchase.fishVarietyId}
          quantityCrates={purchase.quantityCrates}
          quantityKg={purchase.quantityKg}
          draftItems={purchase.draftItems}
          submitting={purchase.submitting}
          onSupplierChange={purchase.setSupplierId}
          onFarmerNameChange={purchase.setFarmerName}
          onLocationChange={purchase.setLocation}
          onVarietyChange={purchase.setFishVarietyId}
          onCratesChange={purchase.setQuantityCrates}
          onKgChange={purchase.setQuantityKg}
          onCreateSupplier={purchase.createSupplier}
          onCatalogItemCreated={purchase.refreshVarieties}
          onAddItem={purchase.addDraftItem}
          onEditItem={purchase.editDraftItem}
          onRemoveItem={purchase.removeDraftItem}
          onSave={purchase.saveBatch}
        />

        <Text style={styles.listTitle}>Purchases for this date</Text>
        {purchase.loading ? (
          <ActivityIndicator size="large" color="#0F766E" style={styles.loader} />
        ) : purchase.groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No purchases recorded for this date.</Text>
          </View>
        ) : purchase.groups.map((group) => (
          <PurchaseGroupCard
            key={group.key}
            group={group}
            collapsed={purchase.collapsedGroups.has(group.key)}
            onToggle={() => purchase.toggleGroup(group.key)}
            onEdit={() => purchase.startEditingGroup(group)}
            onBill={(purchases) => navigation.navigate('PurchaseBillGeneration', {
              supplier_id: group.supplierId,
              supplier_name: group.supplierName,
              farmer_name: group.farmerName,
              location: group.location,
              purchases,
              date: purchase.date,
            })}
          />
        ))}
      </ScrollView>

      <PurchaseGroupEditModal
        group={purchase.editingGroup}
        varieties={purchase.varieties}
        saving={purchase.submitting}
        onCancel={purchase.cancelEditingGroup}
        onSave={purchase.saveGroupEdit}
      />
    </View>
  );
}
