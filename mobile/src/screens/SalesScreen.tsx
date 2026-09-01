import styles from '../styles/SalesScreen.styles';
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import DateNavigator from '../components/DateNavigator';
import { useSalesRecords } from '../features/sales/useSalesRecords';
import AvailableStockStrip from '../features/sales/AvailableStockStrip';
import SalesEntryForm from '../features/sales/SalesEntryForm';
import SalesGroupEditCard from '../features/sales/SalesGroupEditCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SalesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    date, goToPreviousDay, goToNextDay, goToToday,
    varieties, customers, frequentVarietyIds, loading, refreshing, submitting,
    customerId, fishVarietyId, setFishVarietyId,
    quantityCrates, setQuantityCrates, quantityKg, setQuantityKg,
    tempItems, editingCustomerId, editItems, collapsedCustomers, sortedGroupedSales,
    onRefresh, toggleCustomerCollapse, toggleAllCustomers, handleAddItem, handleRemoveTempItem,
    handleEditTempItem, handleSaveAll, handleDelete, handleEditCustomer,
    handleCancelEdit, handleAddVarietyToEdit, handleRemoveEditItem, handleEditItemChange,
    handleSaveEditChanges, getStockForVariety, handleCustomerChange, handleCustomerCreated, refreshVarieties,
  } = useSalesRecords();

  return (
    <ScrollView
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
        getStock={getStockForVariety}
        onCustomerChange={handleCustomerChange}
        onCustomerCreated={handleCustomerCreated}
        onVarietyChange={setFishVarietyId}
        onCratesChange={setQuantityCrates}
        onKgChange={setQuantityKg}
        onCatalogCreated={refreshVarieties}
        onEditDraft={handleEditTempItem}
        onRemoveDraft={handleRemoveTempItem}
        onAdd={handleAddItem}
        onSave={handleSaveAll}
      />

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
            const isEditing = editingCustomerId === customerId;

            return isEditing ? (
              <SalesGroupEditCard
                key={customerName}
                customerName={customerName}
                items={editItems}
                varieties={varieties}
                submitting={submitting}
                onCancel={handleCancelEdit}
                onAddItem={handleAddVarietyToEdit}
                onRemoveItem={handleRemoveEditItem}
                onChange={handleEditItemChange}
                onSave={handleSaveEditChanges}
              />
            ) : (
              /* View Mode */
              <View key={customerName} style={styles.customerGroup}>
                <TouchableOpacity
                  onPress={() => toggleCustomerCollapse(customerId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.customerHeader}>
                    {/* First row: Name and Quantity */}
                    <View style={styles.customerHeaderTop}>
                      <View style={styles.customerHeaderLeft}>
                        <Text style={styles.collapseIcon}>
                          {collapsedCustomers.has(customerId) ? '▶' : '▼'}
                        </Text>
                        <Text style={styles.customerName} numberOfLines={1} ellipsizeMode="tail">
                          {customerName}
                        </Text>
                      </View>
                      <View style={styles.quantityBadge}>
                        <Text style={styles.customerCount}>
                          {[
                            customerSales.reduce((sum, sale) => sum + sale.quantity_crates, 0) > 0
                              ? `${customerSales.reduce((sum, sale) => sum + sale.quantity_crates, 0)} cr`
                              : '',
                            customerSales.reduce((sum, sale) => sum + sale.quantity_kg, 0) > 0
                              ? `${customerSales.reduce((sum, sale) => sum + sale.quantity_kg, 0)} kg`
                              : '',
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </View>

                    {/* Second row: Status and Action Buttons */}
                    <View style={styles.customerHeaderBottom}>
                      {/* Billing Status Indicator */}
                      {customerSales[0]?.billing_status && (
                        <View style={[
                          styles.billingStatusBadge,
                          customerSales[0].billing_status === 'billed' && styles.billingStatusBilled,
                          customerSales[0].billing_status === 'unbilled' && styles.billingStatusUnbilled,
                          customerSales[0].billing_status === 'partial' && styles.billingStatusPartial,
                        ]}>
                          <Text style={[
                            styles.billingStatusIcon,
                            customerSales[0].billing_status === 'billed' && { color: '#059669' },
                            customerSales[0].billing_status === 'unbilled' && { color: '#DC2626' },
                            customerSales[0].billing_status === 'partial' && { color: '#D97706' },
                          ]}>
                            {customerSales[0].billing_status === 'billed' && '✓'}
                            {customerSales[0].billing_status === 'unbilled' && '⚠'}
                            {customerSales[0].billing_status === 'partial' && '◐'}
                          </Text>
                          <Text style={[
                            styles.billingStatusText,
                            customerSales[0].billing_status === 'billed' && { color: '#059669' },
                            customerSales[0].billing_status === 'unbilled' && { color: '#DC2626' },
                            customerSales[0].billing_status === 'partial' && { color: '#D97706' },
                          ]}>
                            {customerSales[0].billing_status === 'billed' && 'Billed'}
                            {customerSales[0].billing_status === 'unbilled' && 'Unbilled'}
                            {customerSales[0].billing_status === 'partial' && 'Partial'}
                          </Text>
                        </View>
                      )}

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
                            }}
                            style={styles.editButton}
                          >
                            <Text style={styles.editButtonText}>Edit</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {!collapsedCustomers.has(customerId) && customerSales.map((sale) => (
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
    </ScrollView>
  );
}
