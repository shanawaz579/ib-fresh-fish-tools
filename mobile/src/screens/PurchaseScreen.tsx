import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import PurchaseEntryForm from '../features/purchases/PurchaseEntryForm';
import PurchaseGroupCard from '../features/purchases/PurchaseGroupCard';
import { usePurchaseRecords } from '../features/purchases/usePurchaseRecords';
import PendingBillsModal, { type PendingBillGroup } from '../features/billing/PendingBillsModal';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/PurchaseScreen.styles';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PurchaseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const purchase = usePurchaseRecords();
  const scrollRef = useRef<ScrollView>(null);
  const [formOffset, setFormOffset] = useState(0);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

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
        ref={scrollRef}
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

        <TouchableOpacity style={styles.pendingButton} onPress={() => setPendingOpen(true)}>
          <View><Text style={styles.pendingButtonTitle}>Pending bills across all dates</Text><Text style={styles.pendingButtonHint}>Find unbilled purchases without checking each day</Text></View>
          <Text style={styles.pendingButtonCount}>{pendingCount === null ? 'View ›' : `${pendingCount} ›`}</Text>
        </TouchableOpacity>

        <View onLayout={(event: LayoutChangeEvent) => setFormOffset(event.nativeEvent.layout.y)}>
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
          errorMessage={purchase.saveError}
          editing={purchase.editingGroup !== null}
          editingLine={purchase.editingDraftPurchaseId !== null}
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
          onCancelEdit={purchase.cancelEditingGroup}
        />
        </View>

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
            onEdit={() => {
              purchase.startEditingGroup(group);
              requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: formOffset, animated: true }));
            }}
            onDelete={() => purchase.deleteGroup(group)}
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

      <PendingBillsModal
        visible={pendingOpen}
        mode="purchases"
        onClose={() => setPendingOpen(false)}
        onCountChange={setPendingCount}
        onOpen={(group: PendingBillGroup) => {
          if (group.kind !== 'purchases') return;
          setPendingOpen(false);
          navigation.navigate('PurchaseBillGeneration', {
            supplier_id: group.partyId,
            supplier_name: group.partyName,
            farmer_name: group.farmerName,
            location: group.location,
            purchases: group.lines,
            date: group.date,
          });
        }}
      />

    </View>
  );
}
