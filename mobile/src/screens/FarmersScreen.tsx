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
  Modal,
} from 'react-native';
import {
  getFarmers,
  addFarmer,
  updateFarmer,
  deleteFarmer,
} from '../api/stock';
import type { Farmer } from '../types';

interface FarmerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  bank_account: string;
  bank_name: string;
  notes: string;
}

const initialFormData: FarmerFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  bank_account: '',
  bank_name: '',
  notes: '',
};

export default function FarmersScreen() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState<FarmerFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<FarmerFormData>(initialFormData);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadFarmers();
  }, []);

  const loadFarmers = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const data = await getFarmers();
    setFarmers(data);

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadFarmers(true);
  };

  const handleAddFarmer = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter farmer name');
      return;
    }

    setSubmitting(true);
    const result = await addFarmer(
      formData.name,
      formData.phone,
      formData.email,
      formData.address,
      formData.city,
      formData.state,
      formData.bank_account,
      formData.bank_name,
      formData.notes
    );

    if (result) {
      setFormData(initialFormData);
      setShowAddForm(false);
      await loadFarmers();
      Alert.alert('Success', 'Farmer added successfully!');
    } else {
      Alert.alert('Error', 'Failed to add farmer. Name, phone, or email might already exist.');
    }
    setSubmitting(false);
  };

  const handleStartEdit = (farmer: Farmer) => {
    setEditingId(farmer.id);
    setEditingData({
      name: farmer.name || '',
      phone: farmer.phone || '',
      email: farmer.email || '',
      address: farmer.address || '',
      city: farmer.city || '',
      state: farmer.state || '',
      bank_account: farmer.bank_account || '',
      bank_name: farmer.bank_name || '',
      notes: farmer.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingData.name.trim()) {
      Alert.alert('Error', 'Please enter farmer name');
      return;
    }

    if (editingId === null) return;

    setSubmitting(true);
    const result = await updateFarmer(
      editingId,
      editingData.name,
      editingData.phone,
      editingData.email,
      editingData.address,
      editingData.city,
      editingData.state,
      editingData.bank_account,
      editingData.bank_name,
      editingData.notes
    );

    if (result) {
      setEditingId(null);
      setEditingData(initialFormData);
      await loadFarmers();
      Alert.alert('Success', 'Farmer updated successfully!');
    } else {
      Alert.alert('Error', 'Failed to update farmer. Name, phone, or email might already exist.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this farmer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            const result = await deleteFarmer(id);
            if (result) {
              await loadFarmers();
              setEditingId(null);
              Alert.alert('Success', 'Farmer deleted successfully!');
            } else {
              Alert.alert('Error', 'Failed to delete farmer');
            }
            setSubmitting(false);
          },
        },
      ]
    );
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData(initialFormData);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Manage Farmers</Text>
        <TouchableOpacity
          onPress={() => setShowAddForm(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Farmers List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
        ) : farmers.length === 0 ? (
          <Text style={styles.emptyText}>No farmers found</Text>
        ) : (
          farmers.map((farmer) => (
            <View key={farmer.id} style={styles.farmerCard}>
              <View style={styles.farmerInfo}>
                <Text style={styles.farmerName}>{farmer.name}</Text>
                <Text style={styles.farmerDetail}>{farmer.phone || 'No phone'}</Text>
                {farmer.city && <Text style={styles.farmerDetail}>{farmer.city}</Text>}
              </View>
              <TouchableOpacity
                onPress={() => handleStartEdit(farmer)}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Farmer Modal */}
      <Modal
        visible={showAddForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add New Farmer</Text>

              <TextInput
                style={styles.input}
                placeholder="Farmer Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Phone"
                value={formData.phone}
                keyboardType="phone-pad"
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={formData.email}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(text) => setFormData({ ...formData, email: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Address"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="City"
                value={formData.city}
                onChangeText={(text) => setFormData({ ...formData, city: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="State"
                value={formData.state}
                onChangeText={(text) => setFormData({ ...formData, state: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Bank Account"
                value={formData.bank_account}
                onChangeText={(text) => setFormData({ ...formData, bank_account: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Bank Name"
                value={formData.bank_name}
                onChangeText={(text) => setFormData({ ...formData, bank_name: text })}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes"
                value={formData.notes}
                multiline
                numberOfLines={3}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={handleAddFarmer}
                  disabled={submitting}
                  style={[styles.modalButton, styles.saveButton, submitting && styles.disabledButton]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Add Farmer</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowAddForm(false);
                    setFormData(initialFormData);
                  }}
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Farmer Modal */}
      <Modal
        visible={editingId !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Farmer</Text>

              <TextInput
                style={styles.input}
                placeholder="Farmer Name *"
                value={editingData.name}
                onChangeText={(text) => setEditingData({ ...editingData, name: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Phone"
                value={editingData.phone}
                keyboardType="phone-pad"
                onChangeText={(text) => setEditingData({ ...editingData, phone: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={editingData.email}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(text) => setEditingData({ ...editingData, email: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Address"
                value={editingData.address}
                onChangeText={(text) => setEditingData({ ...editingData, address: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="City"
                value={editingData.city}
                onChangeText={(text) => setEditingData({ ...editingData, city: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="State"
                value={editingData.state}
                onChangeText={(text) => setEditingData({ ...editingData, state: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Bank Account"
                value={editingData.bank_account}
                onChangeText={(text) => setEditingData({ ...editingData, bank_account: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Bank Name"
                value={editingData.bank_name}
                onChangeText={(text) => setEditingData({ ...editingData, bank_name: text })}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes"
                value={editingData.notes}
                multiline
                numberOfLines={3}
                onChangeText={(text) => setEditingData({ ...editingData, notes: text })}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={submitting}
                  style={[styles.modalButton, styles.saveButton, submitting && styles.disabledButton]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Save</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => editingId && handleDelete(editingId)}
                  style={[styles.modalButton, styles.deleteButton]}
                >
                  <Text style={styles.modalButtonText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCancelEdit}
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    padding: 16,
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
  farmerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  farmerInfo: {
    flex: 1,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  farmerDetail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  editButton: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    marginTop: 8,
  },
  modalButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#10B981',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
