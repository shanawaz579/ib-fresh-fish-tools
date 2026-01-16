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
import { Picker } from '@react-native-picker/picker';
import {
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
} from '../api/stock';
import type { Customer } from '../types';

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  contact_person: string;
  business_type: string;
  notes: string;
}

const initialFormData: CustomerFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  contact_person: '',
  business_type: '',
  notes: '',
};

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<CustomerFormData>(initialFormData);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const data = await getCustomers();
    setCustomers(data);

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadCustomers(true);
  };

  const handleAddCustomer = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    setSubmitting(true);
    const result = await addCustomer(
      formData.name,
      formData.phone,
      formData.email,
      formData.address,
      formData.city,
      formData.state,
      formData.contact_person,
      formData.business_type,
      formData.notes
    );

    if (result) {
      setFormData(initialFormData);
      setShowAddForm(false);
      await loadCustomers();
      Alert.alert('Success', 'Customer added successfully!');
    } else {
      Alert.alert('Error', 'Failed to add customer. Name, phone, or email might already exist.');
    }
    setSubmitting(false);
  };

  const handleStartEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditingData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      contact_person: customer.contact_person || '',
      business_type: customer.business_type || '',
      notes: customer.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingData.name.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    if (editingId === null) return;

    setSubmitting(true);
    const result = await updateCustomer(
      editingId,
      editingData.name,
      editingData.phone,
      editingData.email,
      editingData.address,
      editingData.city,
      editingData.state,
      editingData.contact_person,
      editingData.business_type,
      editingData.notes
    );

    if (result) {
      setEditingId(null);
      setEditingData(initialFormData);
      await loadCustomers();
      Alert.alert('Success', 'Customer updated successfully!');
    } else {
      Alert.alert('Error', 'Failed to update customer. Name, phone, or email might already exist.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this customer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            const result = await deleteCustomer(id);
            if (result) {
              await loadCustomers();
              setEditingId(null);
              Alert.alert('Success', 'Customer deleted successfully!');
            } else {
              Alert.alert('Error', 'Failed to delete customer');
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
        <Text style={styles.title}>Manage Customers</Text>
        <TouchableOpacity
          onPress={() => setShowAddForm(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Customers List */}
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
        ) : customers.length === 0 ? (
          <Text style={styles.emptyText}>No customers found</Text>
        ) : (
          customers.map((customer) => (
            <View key={customer.id} style={styles.customerCard}>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.customerDetail}>{customer.phone || 'No phone'}</Text>
                {customer.business_type && (
                  <Text style={styles.customerDetail}>{customer.business_type}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleStartEdit(customer)}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Customer Modal */}
      <Modal
        visible={showAddForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add New Customer</Text>

              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Customer Name *"
                placeholderTextColor="#9CA3AF"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor="#9CA3AF"
                value={formData.phone}
                keyboardType="phone-pad"
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={formData.email}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(text) => setFormData({ ...formData, email: text })}
              />

              <Text style={styles.label}>Contact Person</Text>
              <TextInput
                style={styles.input}
                placeholder="Contact Person"
                placeholderTextColor="#9CA3AF"
                value={formData.contact_person}
                onChangeText={(text) => setFormData({ ...formData, contact_person: text })}
              />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Address"
                placeholderTextColor="#9CA3AF"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
              />

              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor="#9CA3AF"
                value={formData.city}
                onChangeText={(text) => setFormData({ ...formData, city: text })}
              />

              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="State"
                placeholderTextColor="#9CA3AF"
                value={formData.state}
                onChangeText={(text) => setFormData({ ...formData, state: text })}
              />

              <Text style={styles.label}>Business Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.business_type}
                  onValueChange={(value) => setFormData({ ...formData, business_type: value })}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Business Type" value="" />
                  <Picker.Item label="Restaurant" value="Restaurant" />
                  <Picker.Item label="Hotel/Restaurant" value="Hotel/Restaurant" />
                  <Picker.Item label="Wholesale Market" value="Wholesale Market" />
                  <Picker.Item label="Retail Store" value="Retail Store" />
                  <Picker.Item label="Supermarket" value="Supermarket" />
                  <Picker.Item label="Other" value="Other" />
                </Picker>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes"
                placeholderTextColor="#9CA3AF"
                value={formData.notes}
                multiline
                numberOfLines={3}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={handleAddCustomer}
                  disabled={submitting}
                  style={[styles.modalButton, styles.saveButton, submitting && styles.disabledButton]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Add Customer</Text>
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

      {/* Edit Customer Modal */}
      <Modal
        visible={editingId !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Customer</Text>

              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Customer Name *"
                placeholderTextColor="#9CA3AF"
                value={editingData.name}
                onChangeText={(text) => setEditingData({ ...editingData, name: text })}
              />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor="#9CA3AF"
                value={editingData.phone}
                keyboardType="phone-pad"
                onChangeText={(text) => setEditingData({ ...editingData, phone: text })}
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={editingData.email}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(text) => setEditingData({ ...editingData, email: text })}
              />

              <Text style={styles.label}>Contact Person</Text>
              <TextInput
                style={styles.input}
                placeholder="Contact Person"
                placeholderTextColor="#9CA3AF"
                value={editingData.contact_person}
                onChangeText={(text) => setEditingData({ ...editingData, contact_person: text })}
              />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Address"
                placeholderTextColor="#9CA3AF"
                value={editingData.address}
                onChangeText={(text) => setEditingData({ ...editingData, address: text })}
              />

              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor="#9CA3AF"
                value={editingData.city}
                onChangeText={(text) => setEditingData({ ...editingData, city: text })}
              />

              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="State"
                placeholderTextColor="#9CA3AF"
                value={editingData.state}
                onChangeText={(text) => setEditingData({ ...editingData, state: text })}
              />

              <Text style={styles.label}>Business Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editingData.business_type}
                  onValueChange={(value) => setEditingData({ ...editingData, business_type: value })}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Business Type" value="" />
                  <Picker.Item label="Restaurant" value="Restaurant" />
                  <Picker.Item label="Hotel/Restaurant" value="Hotel/Restaurant" />
                  <Picker.Item label="Wholesale Market" value="Wholesale Market" />
                  <Picker.Item label="Retail Store" value="Retail Store" />
                  <Picker.Item label="Supermarket" value="Supermarket" />
                  <Picker.Item label="Other" value="Other" />
                </Picker>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes"
                placeholderTextColor="#9CA3AF"
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
  customerCard: {
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
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  customerDetail: {
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 4,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginBottom: 12,
  },
  picker: {
    height: 50,
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
