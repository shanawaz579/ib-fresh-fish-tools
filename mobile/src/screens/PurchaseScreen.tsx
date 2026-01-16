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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  getFishVarieties,
  getPurchasesByDate,
  addPurchase,
  deletePurchase,
  updatePurchase,
  getFarmers,
  addFarmer,
} from '../api/stock';
import type { Purchase, FishVariety, Farmer } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PurchaseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [farmerId, setFarmerId] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [secondaryName, setSecondaryName] = useState('');
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
  const [editingFarmerId, setEditingFarmerId] = useState<number | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editSecondaryName, setEditSecondaryName] = useState('');
  const [editItems, setEditItems] = useState<Array<{
    id: number;
    varietyId: number;
    varietyName: string;
    crates: number;
    kg: number;
  }>>([]);

  // Collapse state - track which farmer cards are collapsed
  const [collapsedFarmers, setCollapsedFarmers] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [purchasesData, varietiesData, farmersData] = await Promise.all([
      getPurchasesByDate(date),
      getFishVarieties(),
      getFarmers(),
    ]);
    setPurchases(purchasesData);
    setVarieties(varietiesData);
    setFarmers(farmersData);

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const toggleFarmerCollapse = (farmerId: number) => {
    setCollapsedFarmers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(farmerId)) {
        newSet.delete(farmerId);
      } else {
        newSet.add(farmerId);
      }
      return newSet;
    });
  };

  const toggleAllFarmers = () => {
    const allFarmerIds = Object.values(groupedPurchases).map(purchases => purchases[0]?.farmer_id).filter(Boolean);

    // If all are collapsed, expand all. Otherwise, collapse all.
    const allCollapsed = allFarmerIds.every(id => collapsedFarmers.has(id));

    if (allCollapsed) {
      setCollapsedFarmers(new Set());
    } else {
      setCollapsedFarmers(new Set(allFarmerIds));
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

    // Clear only the variety and quantities, keep farmer selected
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
    if (!farmerId || tempItems.length === 0) {
      Alert.alert('Error', 'Please select a farmer and add at least one item');
      return;
    }

    if (!location || !secondaryName) {
      Alert.alert('Error', 'Please enter Location and Secondary Name');
      return;
    }

    setSubmitting(true);
    try {
      // Save all items
      for (const item of tempItems) {
        await addPurchase(farmerId, item.varietyId, item.crates, item.kg, date, location, secondaryName);
      }

      // Clear form
      setTempItems([]);
      setFarmerId(null);
      setLocation('');
      setSecondaryName('');
      setFishVarietyId(null);
      setQuantityCrates('');
      setQuantityKg('');

      loadData();
      Alert.alert('Success', `${tempItems.length} item(s) added successfully`);
    } catch (err) {
      Alert.alert('Error', 'Failed to add purchases');
    }
    setSubmitting(false);
  };

  const handleChangeFarmer = () => {
    if (tempItems.length > 0) {
      Alert.alert(
        'Change Farmer?',
        'You have unsaved items. Changing farmer will clear them.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Change',
            style: 'destructive',
            onPress: () => {
              setTempItems([]);
              setFarmerId(null);
              setLocation('');
              setSecondaryName('');
            },
          },
        ]
      );
    } else {
      setFarmerId(null);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this purchase?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePurchase(id);
            if (success) {
              loadData();
            } else {
              Alert.alert('Error', 'Failed to delete purchase');
            }
          },
        },
      ]
    );
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

  // Edit mode functions
  const handleEditFarmer = (farmerId: number, farmerPurchases: Purchase[]) => {
    setEditingFarmerId(farmerId);

    // Get location and secondary_name from first purchase (they should all be the same for a farmer)
    const firstPurchase = farmerPurchases[0];
    setEditLocation(firstPurchase?.location || '');
    setEditSecondaryName(firstPurchase?.secondary_name || '');

    setEditItems(farmerPurchases.map(purchase => ({
      id: purchase.id,
      varietyId: purchase.fish_variety_id,
      varietyName: purchase.fish_variety_name || 'Unknown',
      crates: purchase.quantity_crates,
      kg: purchase.quantity_kg,
    })));

    // Ensure the card is expanded when editing
    setCollapsedFarmers(prev => {
      const newSet = new Set(prev);
      newSet.delete(farmerId);
      return newSet;
    });
  };

  const handleCancelEdit = () => {
    setEditingFarmerId(null);
    setEditLocation('');
    setEditSecondaryName('');
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
              const success = await deletePurchase(item.id);
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
    if (!editingFarmerId) return;

    if (!editLocation || !editSecondaryName) {
      Alert.alert('Error', 'Please enter Location and Secondary Name');
      return;
    }

    setSubmitting(true);
    try {
      for (const item of editItems) {
        if (item.varietyId === 0) continue; // Skip empty rows

        if (item.id > 0) {
          // Update existing
          await updatePurchase(item.id, editingFarmerId, item.varietyId, item.crates, item.kg, editLocation, editSecondaryName);
        } else {
          // Create new
          if (item.crates > 0 || item.kg > 0) {
            await addPurchase(editingFarmerId, item.varietyId, item.crates, item.kg, date, editLocation, editSecondaryName);
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

  // Group purchases by farmer
  const groupedPurchases = purchases.reduce((acc, purchase) => {
    const farmerName = purchase.farmer_name || 'Unknown';
    if (!acc[farmerName]) {
      acc[farmerName] = [];
    }
    acc[farmerName].push(purchase);
    return acc;
  }, {} as Record<string, Purchase[]>);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#10B981']}
          tintColor="#10B981"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Purchase Records</Text>
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

      {/* Add Purchase Form */}
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>
            {farmerId ? `Adding items for ${farmers.find(f => f.id === farmerId)?.name}` : 'Add New Purchase'}
          </Text>
          {farmerId && tempItems.length > 0 && (
            <TouchableOpacity onPress={handleChangeFarmer} style={styles.changeFarmerButton}>
              <Text style={styles.changeFarmerText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>

        {!farmerId ? (
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Select Farmer</Text>
            <Picker
              selectedValue={farmerId}
              onValueChange={(value) => setFarmerId(value)}
              style={styles.picker}
            >
              <Picker.Item label="Choose a farmer..." value={null} />
              {farmers.map((farmer) => (
                <Picker.Item key={farmer.id} label={farmer.name} value={farmer.id} />
              ))}
            </Picker>
          </View>
        ) : (
          <>
            {/* Location and Secondary Name Fields */}
            <View style={styles.row}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  Location <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Market, Farm, Dock"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  Secondary Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Alternate name"
                  value={secondaryName}
                  onChangeText={setSecondaryName}
                />
              </View>
            </View>

            {/* Temp Items Preview */}
            {tempItems.length > 0 && (
              <View style={styles.tempItemsContainer}>
                <Text style={styles.tempItemsTitle}>Items to save ({tempItems.length})</Text>
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
              >
                <Picker.Item label="Select Fish Type" value={null} />
                {varieties.map((variety) => (
                  <Picker.Item key={variety.id} label={variety.name} value={variety.id} />
                ))}
              </Picker>
            </View>

            <View style={styles.row}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Crates</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={quantityCrates}
                  onChangeText={setQuantityCrates}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Kg</Text>
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

      {/* Purchases List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Today's Purchases</Text>
          {Object.keys(groupedPurchases).length > 0 && (
            <TouchableOpacity
              onPress={toggleAllFarmers}
              style={styles.toggleAllButton}
            >
              <Text style={styles.toggleAllText}>
                {Object.values(groupedPurchases).every((purchases) =>
                  collapsedFarmers.has(purchases[0]?.farmer_id)
                ) ? '▼ Expand All' : '▲ Collapse All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#10B981" style={styles.loader} />
        ) : Object.keys(groupedPurchases).length === 0 ? (
          <Text style={styles.emptyText}>No purchases for this date</Text>
        ) : (
          Object.entries(groupedPurchases).map(([farmerName, farmerPurchases]) => {
            const farmerId = farmerPurchases[0]?.farmer_id;
            const isEditing = editingFarmerId === farmerId;

            return isEditing ? (
              /* Edit Mode */
              <View key={farmerName} style={[styles.farmerGroup, styles.editMode]}>
                <View style={styles.editHeader}>
                  <Text style={styles.editTitle}>Editing: {farmerName}</Text>
                  <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelEditButton}>
                    <Text style={styles.cancelEditText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                {/* Location and Secondary Name in Edit Mode */}
                <View style={styles.editItemContainer}>
                  <View style={styles.editRow}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>
                        Location <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.editInput}
                        placeholder="Market, Farm, Dock"
                        value={editLocation}
                        onChangeText={setEditLocation}
                      />
                    </View>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>
                        Secondary Name <Text style={styles.required}>*</Text>
                      </Text>
                      <TextInput
                        style={styles.editInput}
                        placeholder="Alternate name"
                        value={editSecondaryName}
                        onChangeText={setEditSecondaryName}
                      />
                    </View>
                  </View>
                </View>

                {editItems.map((item, index) => (
                  <View key={index} style={styles.editItemContainer}>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={item.varietyId}
                        onValueChange={(value) => handleEditItemChange(index, 'varietyId', value)}
                        style={styles.editPicker}
                      >
                        <Picker.Item label="Select Fish Type" value={0} />
                        {varieties.map((variety) => (
                          <Picker.Item key={variety.id} label={variety.name} value={variety.id} />
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
              <View key={farmerName} style={styles.farmerGroup}>
                <TouchableOpacity
                  onPress={() => toggleFarmerCollapse(farmerId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.farmerHeader}>
                    <View style={styles.farmerHeaderLeft}>
                      <Text style={styles.collapseIcon}>
                        {collapsedFarmers.has(farmerId) ? '▶' : '▼'}
                      </Text>
                      <View style={styles.farmerNameContainer}>
                        <Text style={styles.farmerName}>{farmerName}</Text>
                        {/* Display Location and Secondary Name as subtitle */}
                        {(farmerPurchases[0]?.location || farmerPurchases[0]?.secondary_name) && (
                          <Text style={styles.farmerSubtitle}>
                            {farmerPurchases[0]?.location && farmerPurchases[0]?.location}
                            {farmerPurchases[0]?.location && farmerPurchases[0]?.secondary_name && ' • '}
                            {farmerPurchases[0]?.secondary_name && farmerPurchases[0]?.secondary_name}
                          </Text>
                        )}
                        {/* Billing Status Indicator */}
                        {farmerPurchases[0]?.billing_status && (
                          <View style={styles.billingStatusContainer}>
                            <View style={[
                              styles.billingStatusBadge,
                              farmerPurchases[0].billing_status === 'billed' && styles.billingStatusBilled,
                              farmerPurchases[0].billing_status === 'unbilled' && styles.billingStatusUnbilled,
                              farmerPurchases[0].billing_status === 'partial' && styles.billingStatusPartial,
                            ]}>
                              <Text style={styles.billingStatusText}>
                                {farmerPurchases[0].billing_status === 'billed' && '✓ Billed'}
                                {farmerPurchases[0].billing_status === 'unbilled' && '⚠ Not Billed'}
                                {farmerPurchases[0].billing_status === 'partial' && '◐ Partial'}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.farmerHeaderRight}>
                      <Text style={styles.farmerCount}>
                        {farmerPurchases.reduce((sum, p) => sum + p.quantity_crates, 0)} cr
                      </Text>
                      {/* Show Generate Bill button only for unbilled purchases */}
                      {farmerPurchases[0]?.billing_status === 'unbilled' && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            navigation.navigate('PurchaseBillGeneration', {
                              farmer_id: farmerId,
                              farmer_name: farmerName,
                              farmer_location: farmerPurchases[0]?.location,
                              farmer_secondary_name: farmerPurchases[0]?.secondary_name,
                              purchases: farmerPurchases,
                              date: date,
                            });
                          }}
                          style={styles.generateBillButton}
                        >
                          <Text style={styles.generateBillButtonText}>Bill</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleEditFarmer(farmerId, farmerPurchases);
                        }}
                        style={styles.editButton}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>

                {!collapsedFarmers.has(farmerId) && (
                  <>
                    {farmerPurchases.map((purchase) => (
                      <View key={purchase.id} style={styles.purchaseItem}>
                    <View style={styles.purchaseInfo}>
                      <Text style={styles.varietyName}>{purchase.fish_variety_name}</Text>
                      <Text style={styles.quantity}>
                        {purchase.quantity_crates > 0 && `${purchase.quantity_crates} crates`}
                        {purchase.quantity_crates > 0 && purchase.quantity_kg > 0 && ' + '}
                        {purchase.quantity_kg > 0 && `${purchase.quantity_kg} kg`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(purchase.id)}
                      style={styles.deleteButton}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                    ))}
                  </>
                )}
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
    backgroundColor: '#10B981',
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
    backgroundColor: '#10B981',
    borderRadius: 8,
    marginLeft: 8,
  },
  todayButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  changeFarmerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  changeFarmerText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  tempItemsContainer: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tempItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 8,
  },
  tempItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
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
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
  },
  editTempText: {
    color: '#059669',
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
    backgroundColor: '#059669',
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
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
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
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#10B981',
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  toggleAllText: {
    color: '#047857',
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
  farmerGroup: {
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
  farmerHeader: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  farmerHeaderLeft: {
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
  farmerNameContainer: {
    flex: 1,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  farmerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  farmerCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  purchaseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  purchaseInfo: {
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
  farmerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  generateBillButton: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  generateBillButtonText: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
  editMode: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  editHeader: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#047857',
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
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  editInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
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
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#10B981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveChangesText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  required: {
    color: '#DC2626',
    fontSize: 14,
  },
  billingStatusContainer: {
    marginTop: 4,
  },
  billingStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  billingStatusBilled: {
    backgroundColor: '#D1FAE5',
  },
  billingStatusUnbilled: {
    backgroundColor: '#FEE2E2',
  },
  billingStatusPartial: {
    backgroundColor: '#FEF3C7',
  },
  billingStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
