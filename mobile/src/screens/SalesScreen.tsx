import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  getFishVarieties,
  getSalesByDate,
  getPurchasesByDate,
  addSale,
  deleteSale,
  updateSale,
  getCustomers,
  cleanupDuplicateSales,
} from '../api/stock';
import type { Sale, FishVariety, Customer, Purchase } from '../types';

// Hardcoded order for fish varieties - same as web
const VARIETY_ORDER = ['Pangasius', 'Roopchand', 'Rohu', 'Katla', 'Tilapia', 'Silver Carp', 'Grass Carp', 'Common Carp'];
const SIZE_ORDER = ['Big', 'Medium', 'Small'];

// Helper function to sort varieties by hardcoded order
const sortVarietiesByOrder = (varietiesData: FishVariety[]) => {
  return [...varietiesData].sort((a, b) => {
    const nameA = a.name || '';
    const nameB = b.name || '';
    const lowerNameA = nameA.toLowerCase();
    const lowerNameB = nameB.toLowerCase();

    // Find variety type order
    const varietyOrderA = VARIETY_ORDER.findIndex(p => lowerNameA.includes(p.toLowerCase()));
    const varietyOrderB = VARIETY_ORDER.findIndex(p => lowerNameB.includes(p.toLowerCase()));

    // Find size order
    const sizeOrderA = SIZE_ORDER.findIndex(s => nameA.includes(s));
    const sizeOrderB = SIZE_ORDER.findIndex(s => nameB.includes(s));

    // Sort by variety order first
    if (varietyOrderA !== varietyOrderB) {
      if (varietyOrderA === -1) return 1;
      if (varietyOrderB === -1) return -1;
      return varietyOrderA - varietyOrderB;
    }

    // Then by size order
    if (sizeOrderA !== sizeOrderB) {
      if (sizeOrderA === -1 && sizeOrderB === -1) return a.id - b.id;
      if (sizeOrderA === -1) return 1;
      if (sizeOrderB === -1) return -1;
      return sizeOrderA - sizeOrderB;
    }

    return a.id - b.id;
  });
};

export default function SalesScreen() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [fishVarietyId, setFishVarietyId] = useState<number | null>(null);
  const [quantityCrates, setQuantityCrates] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tempItems, setTempItems] = useState<Array<{
    varietyId: number;
    varietyName: string;
    crates: number;
    kg: number;
  }>>([]);

  // Edit mode state
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<Array<{
    id: number;
    varietyId: number;
    varietyName: string;
    crates: number;
    kg: number;
  }>>([]);

  // Collapse state - track which customer cards are collapsed
  const [collapsedCustomers, setCollapsedCustomers] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    // Cleanup duplicates first
    await cleanupDuplicateSales(date);

    const [varietiesData, customersData, purchasesData, salesData] = await Promise.all([
      getFishVarieties(),
      getCustomers(),
      getPurchasesByDate(date),
      getSalesByDate(date),
    ]);

    // Sort varieties same as web
    const sortedVarieties = sortVarietiesByOrder(varietiesData);

    setVarieties(sortedVarieties);
    setCustomers(customersData);
    setPurchases(purchasesData);
    setSales(salesData);

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

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

  const toggleAllCustomers = () => {
    const allCustomerIds = Object.values(groupedSales).map(sales => sales[0]?.customer_id).filter(Boolean);

    // If all are collapsed, expand all. Otherwise, collapse all.
    const allCollapsed = allCustomerIds.every(id => collapsedCustomers.has(id));

    if (allCollapsed) {
      setCollapsedCustomers(new Set());
    } else {
      setCollapsedCustomers(new Set(allCustomerIds));
    }
  };

  const handleAddItem = () => {
    if (!fishVarietyId) {
      Alert.alert('Error', 'Please select fish type');
      return;
    }

    const crates = parseInt(quantityCrates) || 0;
    const kg = parseFloat(quantityKg) || 0;

    if (crates === 0 && kg === 0) {
      Alert.alert('Error', 'Please enter quantity');
      return;
    }

    const variety = varieties.find(v => v.id === fishVarietyId);
    if (!variety) return;

    // Check if variety already exists in temp items
    const existingIndex = tempItems.findIndex(item => item.varietyId === fishVarietyId);
    if (existingIndex >= 0) {
      // Update existing item
      const updated = [...tempItems];
      updated[existingIndex].crates += crates;
      updated[existingIndex].kg += kg;
      setTempItems(updated);
    } else {
      // Add new item
      setTempItems([...tempItems, {
        varietyId: fishVarietyId,
        varietyName: variety.name,
        crates,
        kg,
      }]);
    }

    // Clear only the variety and quantities, keep customer selected
    setFishVarietyId(null);
    setQuantityCrates('');
    setQuantityKg('');
  };

  const handleRemoveTempItem = (index: number) => {
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  const handleEditTempItem = (index: number) => {
    const item = tempItems[index];

    // Load item into form
    setFishVarietyId(item.varietyId);
    setQuantityCrates(item.crates.toString());
    setQuantityKg(item.kg.toString());

    // Remove from temp list
    setTempItems(tempItems.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (!customerId || tempItems.length === 0) {
      Alert.alert('Error', 'Please select a customer and add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      // Save all items
      for (const item of tempItems) {
        await addSale(customerId, item.varietyId, item.crates, item.kg, date);
      }

      // Clear form
      setTempItems([]);
      setCustomerId(null);
      setFishVarietyId(null);
      setQuantityCrates('');
      setQuantityKg('');

      loadData();
      Alert.alert('Success', `${tempItems.length} item(s) added successfully`);
    } catch (err) {
      Alert.alert('Error', 'Failed to add sales');
    }
    setSubmitting(false);
  };

  const handleChangeCustomer = () => {
    if (tempItems.length > 0) {
      Alert.alert(
        'Change Customer?',
        'You have unsaved items. Changing customer will clear them.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Change',
            style: 'destructive',
            onPress: () => {
              setTempItems([]);
              setCustomerId(null);
            },
          },
        ]
      );
    } else {
      setCustomerId(null);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this sale?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteSale(id);
            if (success) {
              loadData();
            } else {
              Alert.alert('Error', 'Failed to delete sale');
            }
          },
        },
      ]
    );
  };

  // Edit mode functions
  const handleEditCustomer = (customerId: number, customerSales: Sale[]) => {
    setEditingCustomerId(customerId);
    setEditItems(customerSales.map(sale => ({
      id: sale.id,
      varietyId: sale.fish_variety_id,
      varietyName: sale.fish_variety_name || 'Unknown',
      crates: sale.quantity_crates,
      kg: sale.quantity_kg,
    })));

    // Ensure the card is expanded when editing
    setCollapsedCustomers(prev => {
      const newSet = new Set(prev);
      newSet.delete(customerId);
      return newSet;
    });
  };

  const handleCancelEdit = () => {
    setEditingCustomerId(null);
    setEditItems([]);
  };

  const handleAddVarietyToEdit = () => {
    setEditItems([...editItems, { id: 0, varietyId: 0, varietyName: '', crates: 0, kg: 0 }]);
  };

  const handleRemoveEditItem = async (index: number) => {
    const item = editItems[index];

    // If it has an ID, delete from database
    if (item.id > 0) {
      Alert.alert(
        'Delete Item',
        'Are you sure you want to delete this item?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const success = await deleteSale(item.id);
              if (success) {
                setEditItems(editItems.filter((_, i) => i !== index));
              } else {
                Alert.alert('Error', 'Failed to delete item');
              }
            },
          },
        ]
      );
    } else {
      // Just remove from list (not saved yet)
      setEditItems(editItems.filter((_, i) => i !== index));
    }
  };

  const handleEditItemChange = (index: number, field: 'varietyId' | 'crates' | 'kg', value: any) => {
    const updated = [...editItems];
    if (field === 'varietyId') {
      const variety = varieties.find(v => v.id === value);
      updated[index].varietyId = value;
      updated[index].varietyName = variety?.name || '';
    } else {
      updated[index][field] = field === 'kg' ? parseFloat(value) || 0 : parseInt(value) || 0;
    }
    setEditItems(updated);
  };

  const handleSaveEditChanges = async () => {
    if (!editingCustomerId) return;

    setSubmitting(true);
    try {
      for (const item of editItems) {
        if (item.varietyId === 0) continue; // Skip empty rows

        if (item.id > 0) {
          // Update existing
          await updateSale(item.id, editingCustomerId, item.varietyId, item.crates, item.kg);
        } else {
          // Create new
          if (item.crates > 0 || item.kg > 0) {
            await addSale(editingCustomerId, item.varietyId, item.crates, item.kg, date);
          }
        }
      }

      handleCancelEdit();
      loadData();
      Alert.alert('Success', 'Changes saved successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to save changes');
    }
    setSubmitting(false);
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

  // Calculate stock for a variety
  const getStockForVariety = (varietyId: number) => {
    const purchased = purchases
      .filter(p => p.fish_variety_id === varietyId)
      .reduce((sum, p) => ({ crates: sum.crates + p.quantity_crates, kg: sum.kg + p.quantity_kg }), { crates: 0, kg: 0 });

    const sold = sales
      .filter(s => s.fish_variety_id === varietyId)
      .reduce((sum, s) => ({ crates: sum.crates + s.quantity_crates, kg: sum.kg + s.quantity_kg }), { crates: 0, kg: 0 });

    return {
      purchased,
      sold,
      available: {
        crates: purchased.crates - sold.crates,
        kg: purchased.kg - sold.kg,
      },
    };
  };

  // Group sales by customer
  const groupedSales = sales.reduce((acc, sale) => {
    const customerName = sale.customer_name || 'Unknown';
    if (!acc[customerName]) {
      acc[customerName] = [];
    }
    acc[customerName].push(sale);
    return acc;
  }, {} as Record<string, Sale[]>);

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
        <Text style={styles.title}>Sales Records</Text>
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

      {/* Stock Summary */}
      <View style={styles.stockContainer}>
        <Text style={styles.stockTitle}>Today's Stock</Text>
        {varieties.map(variety => {
          const stock = getStockForVariety(variety.id);
          const isLow = stock.available.crates < 0 || stock.available.kg < 0;
          const hasStock = stock.purchased.crates > 0 || stock.purchased.kg > 0;

          // Only show varieties that have stock
          if (!hasStock) return null;

          return (
            <View key={variety.id} style={styles.stockItem}>
              <Text style={styles.stockVariety}>{variety.name}</Text>
              <Text style={[styles.stockCrates, isLow && styles.stockCratesLow]}>
                {stock.available.crates}/{stock.purchased.crates}
                {stock.purchased.kg > 0 && (
                  <Text style={styles.stockKg}>
                    {' '}({stock.available.kg}/{stock.purchased.kg} kg)
                  </Text>
                )}
              </Text>
            </View>
          );
        })}
        {varieties.every(v => {
          const stock = getStockForVariety(v.id);
          return stock.purchased.crates === 0 && stock.purchased.kg === 0;
        }) && (
          <Text style={styles.emptyStock}>No stock available for today</Text>
        )}
      </View>

      {/* Add Sale Form */}
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>
            {customerId ? `Adding items for ${customers.find(c => c.id === customerId)?.name}` : 'Add New Sale'}
          </Text>
          {customerId && tempItems.length > 0 && (
            <TouchableOpacity onPress={handleChangeCustomer} style={styles.changeCustomerButton}>
              <Text style={styles.changeCustomerText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>

        {!customerId ? (
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Select Customer</Text>
            <Picker
              selectedValue={customerId}
              onValueChange={(value) => setCustomerId(value)}
              style={styles.picker}
              dropdownIconColor="#111827"
            >
              <Picker.Item label="Choose a customer..." value={null} color="#6B7280" />
              {customers.map((customer) => (
                <Picker.Item key={customer.id} label={customer.name} value={customer.id} color="#111827" />
              ))}
            </Picker>
          </View>
        ) : (
          <>
            {/* Temp Items Preview */}
            {tempItems.length > 0 && (
              <View style={styles.tempItemsContainer}>
                <View style={styles.tempItemsHeader}>
                  <Text style={styles.tempItemsTitle}>Items to save ({tempItems.length})</Text>
                  <View style={styles.tempTotalContainer}>
                    <Text style={styles.tempTotalLabel}>Total:</Text>
                    <Text style={styles.tempTotalValue}>
                      {tempItems.reduce((sum, item) => sum + item.crates, 0)} crates
                      {tempItems.reduce((sum, item) => sum + item.kg, 0) > 0 &&
                        `, ${tempItems.reduce((sum, item) => sum + item.kg, 0).toFixed(1)} kg`
                      }
                    </Text>
                  </View>
                </View>
                {tempItems.map((item, index) => (
                  <View key={index} style={styles.tempItem}>
                    <View style={styles.tempItemInfo}>
                      <Text style={styles.tempItemName}>{item.varietyName}</Text>
                      <Text style={styles.tempItemQty}>
                        {item.crates > 0 && `${item.crates} cr`}
                        {item.crates > 0 && item.kg > 0 && ' + '}
                        {item.kg > 0 && `${item.kg} kg`}
                      </Text>
                    </View>
                    <View style={styles.tempItemActions}>
                      <TouchableOpacity
                        onPress={() => handleEditTempItem(index)}
                        style={styles.editTempButton}
                      >
                        <Text style={styles.editTempText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveTempItem(index)}
                        style={styles.removeTempButton}
                      >
                        <Text style={styles.removeTempText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Add Items Form */}
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Fish Type</Text>
              <Picker
                selectedValue={fishVarietyId}
                onValueChange={(value) => setFishVarietyId(value)}
                style={styles.picker}
                dropdownIconColor="#111827"
              >
                <Picker.Item label="Select Fish Type" value={null} color="#6B7280" />
                {varieties
                  .filter((variety) => {
                    const stock = getStockForVariety(variety.id);
                    return stock.purchased.crates > 0 || stock.purchased.kg > 0;
                  })
                  .map((variety) => (
                    <Picker.Item key={variety.id} label={variety.name} value={variety.id} color="#111827" />
                  ))}
              </Picker>
            </View>

            <View style={styles.row}>
              <View style={styles.inputContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Crates</Text>
                  {fishVarietyId && (() => {
                    const stock = getStockForVariety(fishVarietyId);
                    const isLow = stock.available.crates < 0;
                    return (
                      <Text style={[styles.availableText, isLow && styles.availableTextLow]}>
                        (Avl: {stock.available.crates})
                      </Text>
                    );
                  })()}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={quantityCrates}
                  onChangeText={setQuantityCrates}
                />
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Kg</Text>
                  {fishVarietyId && (() => {
                    const stock = getStockForVariety(fishVarietyId);
                    const isLow = stock.available.kg < 0;
                    return stock.purchased.kg > 0 ? (
                      <Text style={[styles.availableText, isLow && styles.availableTextLow]}>
                        (Avl: {stock.available.kg})
                      </Text>
                    ) : null;
                  })()}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={quantityKg}
                  onChangeText={setQuantityKg}
                />
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleAddItem}
                style={[styles.addItemButton, styles.flexButton]}
              >
                <Text style={styles.addItemButtonText}>+ Add Item</Text>
              </TouchableOpacity>

              {tempItems.length > 0 && (
                <TouchableOpacity
                  onPress={handleSaveAll}
                  disabled={submitting}
                  style={[styles.saveAllButton, styles.flexButton, submitting && styles.submitButtonDisabled]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveAllButtonText}>Save All ({tempItems.length})</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      {/* Sales List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Today's Sales</Text>
          {Object.keys(groupedSales).length > 0 && (
            <TouchableOpacity
              onPress={toggleAllCustomers}
              style={styles.toggleAllButton}
            >
              <Text style={styles.toggleAllText}>
                {Object.values(groupedSales).every((sales) =>
                  collapsedCustomers.has(sales[0]?.customer_id)
                ) ? '▼ Expand All' : '▲ Collapse All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
        ) : Object.keys(groupedSales).length === 0 ? (
          <Text style={styles.emptyText}>No sales for this date</Text>
        ) : (
          Object.entries(groupedSales).map(([customerName, customerSales]) => {
            const customerId = customerSales[0]?.customer_id;
            const isEditing = editingCustomerId === customerId;

            return isEditing ? (
              /* Edit Mode */
              <View key={customerName} style={[styles.customerGroup, styles.editMode]}>
                <View style={styles.editHeader}>
                  <Text style={styles.editTitle}>Editing: {customerName}</Text>
                  <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelEditButton}>
                    <Text style={styles.cancelEditText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                {editItems.map((item, index) => (
                  <View key={index} style={styles.editItemContainer}>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={item.varietyId}
                        onValueChange={(value) => handleEditItemChange(index, 'varietyId', value)}
                        style={styles.editPicker}
                        dropdownIconColor="#111827"
                      >
                        <Picker.Item label="Select Fish Type" value={0} color="#6B7280" />
                        {varieties.map((variety) => (
                          <Picker.Item key={variety.id} label={variety.name} value={variety.id} color="#111827" />
                        ))}
                      </Picker>
                    </View>

                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.editInput}
                        placeholder="Crates"
                        keyboardType="numeric"
                        value={item.crates.toString()}
                        onChangeText={(value) => handleEditItemChange(index, 'crates', value)}
                      />
                      <TextInput
                        style={styles.editInput}
                        placeholder="Kg"
                        keyboardType="decimal-pad"
                        value={item.kg.toString()}
                        onChangeText={(value) => handleEditItemChange(index, 'kg', value)}
                      />
                      <TouchableOpacity
                        onPress={() => handleRemoveEditItem(index)}
                        style={styles.removeEditButton}
                      >
                        <Text style={styles.removeEditText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <View style={styles.editActions}>
                  <TouchableOpacity onPress={handleAddVarietyToEdit} style={styles.addVarietyButton}>
                    <Text style={styles.addVarietyText}>+ Add Variety</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveEditChanges}
                    disabled={submitting}
                    style={[styles.saveChangesButton, submitting && styles.submitButtonDisabled]}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveChangesText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* View Mode */
              <View key={customerName} style={styles.customerGroup}>
                <TouchableOpacity
                  onPress={() => toggleCustomerCollapse(customerId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.customerHeader}>
                    <View style={styles.customerHeaderLeft}>
                      <Text style={styles.collapseIcon}>
                        {collapsedCustomers.has(customerId) ? '▶' : '▼'}
                      </Text>
                      <Text style={styles.customerName}>{customerName}</Text>
                    </View>
                    <View style={styles.customerHeaderRight}>
                      <Text style={styles.customerCount}>
                        {customerSales.reduce((sum, s) => sum + s.quantity_crates, 0)} cr
                      </Text>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleEditCustomer(customerId, customerSales);
                        }}
                        style={styles.editButton}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>

                {!collapsedCustomers.has(customerId) && customerSales.map((sale) => (
                  <View key={sale.id} style={styles.saleItem}>
                    <View style={styles.saleInfo}>
                      <Text style={styles.varietyName}>{sale.fish_variety_name}</Text>
                      <Text style={styles.quantity}>
                        {sale.quantity_crates > 0 && `${sale.quantity_crates} crates`}
                        {sale.quantity_crates > 0 && sale.quantity_kg > 0 && ' + '}
                        {sale.quantity_kg > 0 && `${sale.quantity_kg} kg`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(sale.id)}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#3B82F6',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
  stockContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stockTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
  },
  stockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stockVariety: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  stockDetails: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  stockCrates: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  stockCratesLow: {
    color: '#DC2626',
  },
  stockKg: {
    fontSize: 13,
    fontWeight: 'normal',
    color: '#6B7280',
  },
  stockLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  stockValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  stockValueLow: {
    color: '#DC2626',
  },
  emptyStock: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  formContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  changeCustomerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  changeCustomerText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  tempItemsContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tempItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tempItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  tempTotalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tempTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  tempTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  tempItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  tempItemInfo: {
    flex: 1,
  },
  tempItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  tempItemQty: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  tempItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editTempButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
  },
  editTempText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  removeTempButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTempText: {
    color: '#DC2626',
    fontSize: 20,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flexButton: {
    flex: 1,
  },
  addItemButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveAllButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    color: '#111827',
    paddingHorizontal: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  availableText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  availableTextLow: {
    color: '#DC2626',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    margin: 16,
    marginBottom: 32,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  toggleAllButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  toggleAllText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  loader: {
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 16,
    marginTop: 32,
  },
  customerGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  customerHeader: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  collapseIcon: {
    fontSize: 12,
    color: '#6B7280',
    width: 16,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  saleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  saleInfo: {
    flex: 1,
  },
  varietyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  quantity: {
    fontSize: 14,
    color: '#6B7280',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  customerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  editMode: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  editHeader: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  cancelEditButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelEditText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  editItemContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  editPicker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    color: '#111827',
    paddingHorizontal: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
  },
  removeEditButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeEditText: {
    color: '#DC2626',
    fontSize: 22,
    fontWeight: 'bold',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },
  addVarietyButton: {
    flex: 1,
    backgroundColor: '#10B981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addVarietyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  saveChangesButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveChangesText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
