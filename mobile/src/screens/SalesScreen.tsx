import styles from '../styles/SalesScreen.styles';
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  type LayoutChangeEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import DateNavigator from '../components/DateNavigator';
import { useSalesRecords } from '../features/sales/useSalesRecords';
import AvailableStockStrip from '../features/sales/AvailableStockStrip';
import SalesEntryForm from '../features/sales/SalesEntryForm';
import ExistingSaleModal from '../features/sales/ExistingSaleModal';
import QuickCustomerPaymentModal from '../features/sales/QuickCustomerPaymentModal';
import { getCustomerLocation } from '../domain/customers';
import type { Sale } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SalesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const scrollRef = useRef<ScrollView>(null);
  const [formOffset, setFormOffset] = useState(0);
  const [existingSalePrompt, setExistingSalePrompt] = useState<{ customerId: number; customerName: string; sales: Sale[] } | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<{ customerId: number; customerName: string } | null>(null);
  const {
    date, goToPreviousDay, goToNextDay, goToToday,
    varieties, customers, frequentVarietyIds, loading, refreshing, submitting,
    customerId, fishVarietyId, setFishVarietyId,
    quantityCrates, setQuantityCrates, quantityKg, setQuantityKg,
    tempItems, editingCustomerId, editingDraftVarietyId, collapsedCustomers, sortedGroupedSales,
    onRefresh, toggleCustomerCollapse, toggleAllCustomers, handleAddItem, handleRemoveTempItem,
    handleEditTempItem, handleSaveAll, handleDelete, handleEditCustomer,
    handleCancelEdit, getStockForVariety, handleCustomerChange, handleCustomerCreated, refreshVarieties,
  } = useSalesRecords();

  const selectCustomer = (nextCustomerId: number | null) => {
    if (!nextCustomerId || editingCustomerId !== null) { handleCustomerChange(nextCustomerId); return; }
    const existingSales = Object.values(sortedGroupedSales).flat().filter(sale => sale.customer_id === nextCustomerId);
    if (!existingSales.length) { handleCustomerChange(nextCustomerId); return; }
    setExistingSalePrompt({
      customerId: nextCustomerId,
      customerName: existingSales[0]?.customer_name || customers.find(customer => customer.id === nextCustomerId)?.name || 'This customer',
      sales: existingSales,
    });
  };

  const editExistingSale = () => {
    if (!existingSalePrompt) return;
    const { customerId: existingCustomerId, customerName, sales: existingSales } = existingSalePrompt;
    setExistingSalePrompt(null);
    if (existingSales.every(sale => sale.billing_status === 'unbilled')) {
      handleEditCustomer(existingCustomerId, existingSales);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: formOffset, animated: true }));
      return;
    }
    navigation.navigate('BillGeneration', { customer_id: existingCustomerId, customer_name: customerName, date });
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#3B82F6']}
          tintColor="#3B82F6"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Sales</Text>
          <Text style={styles.headerSubtitle}>Dispatch available stock to customers</Text>
        </View>
      </View>

      <DateNavigator date={date} onPrevious={goToPreviousDay} onNext={goToNextDay} onToday={goToToday} />

      <AvailableStockStrip varieties={varieties} getStock={getStockForVariety} onSelect={setFishVarietyId} />

      <View onLayout={(event: LayoutChangeEvent) => setFormOffset(event.nativeEvent.layout.y)}>
      <SalesEntryForm
        customers={customers}
        varieties={varieties}
        frequentVarietyIds={frequentVarietyIds}
        customerId={customerId}
        varietyId={fishVarietyId}
        crates={quantityCrates}
        kg={quantityKg}
        drafts={tempItems}
        submitting={submitting}
        editing={editingCustomerId !== null}
        editingDraft={editingDraftVarietyId !== null}
        getStock={getStockForVariety}
        onCustomerChange={selectCustomer}
        onCustomerCreated={handleCustomerCreated}
        onVarietyChange={setFishVarietyId}
        onCratesChange={setQuantityCrates}
        onKgChange={setQuantityKg}
        onCatalogCreated={refreshVarieties}
        onEditDraft={handleEditTempItem}
        onRemoveDraft={handleRemoveTempItem}
        onAdd={handleAddItem}
        onSave={handleSaveAll}
        onCancelEdit={handleCancelEdit}
      />
      </View>

      {/* Sales List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Sales for this date</Text>
          {Object.keys(sortedGroupedSales).length > 0 && (
            <TouchableOpacity
              onPress={toggleAllCustomers}
              style={styles.toggleAllButton}
            >
              <Text style={styles.toggleAllText}>
                {Object.values(sortedGroupedSales).every((sales) =>
                  collapsedCustomers.has(sales[0]?.customer_id)
                ) ? '▼ Expand All' : '▲ Collapse All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
        ) : Object.keys(sortedGroupedSales).length === 0 ? (
          <Text style={styles.emptyText}>No sales for this date</Text>
        ) : (
          Object.entries(sortedGroupedSales).map(([customerName, customerSales]) => {
            const customerId = customerSales[0]?.customer_id;
            const customerLocation = getCustomerLocation(customers.find(customer => customer.id === customerId));
            const isCollapsed = collapsedCustomers.has(customerId);
            const totalCrates = customerSales.reduce((sum, sale) => sum + sale.quantity_crates, 0);
            const totalKg = customerSales.reduce((sum, sale) => sum + sale.quantity_kg, 0);
            const quantityText = [totalCrates > 0 ? `${totalCrates} cr` : '', totalKg > 0 ? `${totalKg} kg` : '']
              .filter(Boolean)
              .join(' · ');
            const billingStatus = customerSales[0]?.billing_status;
            return (
              /* View Mode */
              <View key={customerName} style={styles.customerGroup}>
                <TouchableOpacity
                  onPress={() => toggleCustomerCollapse(customerId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.customerHeader}>
                    <View style={styles.customerHeaderTop}>
                      <View style={styles.customerHeaderLeft}>
                        <Text style={styles.collapseIcon}>
                          {isCollapsed ? '▶' : '▼'}
                        </Text>
                        <View style={styles.customerIdentity}>
                          <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">
                            {customerName}
                          </Text>
                          {customerLocation ? <Text style={styles.customerLocation} numberOfLines={1}>{customerLocation}</Text> : null}
                        </View>
                      </View>
                      <View style={styles.customerHeaderSummary}>
                        <View style={styles.quantityBadge}>
                          <Text style={styles.customerCount}>{quantityText}</Text>
                        </View>
                        {billingStatus ? (
                          <View style={[
                            styles.billingStatusBadge,
                            billingStatus === 'billed' && styles.billingStatusBilled,
                            billingStatus === 'unbilled' && styles.billingStatusUnbilled,
                            billingStatus === 'partial' && styles.billingStatusPartial,
                          ]}>
                            <Text style={[
                              styles.billingStatusIcon,
                              billingStatus === 'billed' && { color: '#059669' },
                              billingStatus === 'unbilled' && { color: '#DC2626' },
                              billingStatus === 'partial' && { color: '#D97706' },
                            ]}>
                              {billingStatus === 'billed' && '✓'}
                              {billingStatus === 'unbilled' && '⚠'}
                              {billingStatus === 'partial' && '◐'}
                            </Text>
                            <Text style={[
                              styles.billingStatusText,
                              billingStatus === 'billed' && { color: '#059669' },
                              billingStatus === 'unbilled' && { color: '#DC2626' },
                              billingStatus === 'partial' && { color: '#D97706' },
                            ]}>
                              {billingStatus === 'billed' && 'Billed'}
                              {billingStatus === 'unbilled' && 'Unbilled'}
                              {billingStatus === 'partial' && 'Partial'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {!isCollapsed ? <View style={styles.customerHeaderActions}>
                      <View style={styles.actionButtons}>
                        {/* Show Generate Bill button only for unbilled sales */}
                        {customerSales.every((sale) => sale.billing_status === 'unbilled') && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              navigation.navigate('BillGeneration', {
                                customer_id: customerId,
                                customer_name: customerName,
                                date: date,
                              });
                            }}
                            style={styles.generateBillButton}
                          >
                            <Text style={styles.generateBillButtonText}>Bill</Text>
                          </TouchableOpacity>
                        )}
                        {customerSales.every((sale) => sale.billing_status === 'unbilled') ? (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleEditCustomer(customerId, customerSales);
                              requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: formOffset, animated: true }));
                            }}
                            style={styles.editButton}
                          >
                            <Text style={styles.editButtonText}>Edit</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setPaymentTarget({ customerId, customerName });
                            }}
                            style={styles.paymentButton}
                          >
                            <Text style={styles.paymentButtonText}>Payment</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View> : null}
                  </View>
                </TouchableOpacity>

                {!isCollapsed && customerSales.map((sale) => (
                  <View key={sale.id} style={styles.saleItem}>
                    <View style={styles.saleInfo}>
                      <Text style={styles.varietyName}>{sale.fish_variety_name}</Text>
                      <Text style={styles.quantity}>
                        {sale.quantity_crates > 0 && `${sale.quantity_crates} cr`}
                        {sale.quantity_crates > 0 && sale.quantity_kg > 0 && ' · '}
                        {sale.quantity_kg > 0 && `${sale.quantity_kg} kg`}
                      </Text>
                    </View>
                    {sale.billing_status === 'unbilled' ? (
                      <TouchableOpacity
                        onPress={() => handleDelete(sale.id)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            );
          })
        )}
      </View>

      <ExistingSaleModal
        visible={Boolean(existingSalePrompt)}
        customerName={existingSalePrompt?.customerName}
        billed={Boolean(existingSalePrompt && !existingSalePrompt.sales.every(sale => sale.billing_status === 'unbilled'))}
        onClose={() => setExistingSalePrompt(null)}
        onEdit={editExistingSale}
      />
      <QuickCustomerPaymentModal
        visible={Boolean(paymentTarget)}
        customerId={paymentTarget?.customerId}
        customerName={paymentTarget?.customerName}
        date={date}
        onClose={() => setPaymentTarget(null)}
      />
    </ScrollView>
  );
}
