import styles from '../styles/CustomersScreen.styles';
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useCustomersManagement } from '../features/customers/useCustomersManagement';

export default function CustomersScreen() {
  const {
    customers, loading, refreshing, formData, setFormData, submitting,
    editingId, editingData, setEditingData, showAddForm, setShowAddForm,
    onRefresh, handleAddCustomer, handleStartEdit, handleSaveEdit, handleDelete, handleCancelEdit, closeAddForm,
  } = useCustomersManagement();

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
                  onPress={closeAddForm}
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
