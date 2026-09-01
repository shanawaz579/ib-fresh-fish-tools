import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { addSupplier, deleteSupplier, getSuppliers, updateSupplier } from '../api/stock';
import SupplierFormModal, {
  emptySupplierForm,
} from '../features/suppliers/SupplierFormModal';
import styles from '../styles/FarmersScreen.styles';
import type { Supplier, SupplierCreateInput } from '../types';

function supplierToForm(supplier: Supplier): SupplierCreateInput {
  return {
    supplierType: supplier.supplier_type,
    name: supplier.name,
    location: supplier.location,
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    city: supplier.city ?? '',
    state: supplier.state ?? '',
    bankAccount: supplier.bank_account ?? '',
    bankName: supplier.bank_name ?? '',
    notes: supplier.notes ?? '',
  };
}

export default function FarmersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<SupplierCreateInput>(emptySupplierForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SupplierCreateInput>(emptySupplierForm);

  const loadSuppliers = async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);
    setSuppliers(await getSuppliers());
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const valid = (form: SupplierCreateInput) => {
    if (form.name.trim() && form.location.trim()) return true;
    Alert.alert('Incomplete supplier', 'Supplier name and location are required.');
    return false;
  };

  const handleAdd = async () => {
    if (!valid(addForm)) return;
    setSubmitting(true);
    const created = await addSupplier(addForm);
    if (created) {
      setShowAddForm(false);
      setAddForm(emptySupplierForm);
      await loadSuppliers();
      Alert.alert('Supplier added', 'The supplier account is ready to use.');
    } else {
      Alert.alert('Unable to add supplier', 'The same type, name, and location may already exist.');
    }
    setSubmitting(false);
  };

  const handleEdit = async () => {
    if (editingId === null || !valid(editForm)) return;
    setSubmitting(true);
    const updated = await updateSupplier(editingId, editForm);
    if (updated) {
      setEditingId(null);
      setEditForm(emptySupplierForm);
      await loadSuppliers();
      Alert.alert('Supplier updated', 'Changes have been saved.');
    } else {
      Alert.alert(
        'Unable to update supplier',
        'Check for a duplicate account. Supplier type also cannot change after purchases exist.',
      );
    }
    setSubmitting(false);
  };

  const handleDelete = () => {
    if (editingId === null) return;
    Alert.alert('Delete supplier?', 'Used supplier accounts cannot be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          if (await deleteSupplier(editingId)) {
            setEditingId(null);
            setEditForm(emptySupplierForm);
            await loadSuppliers();
          } else {
            Alert.alert('Unable to delete supplier', 'This supplier may already be used by a purchase.');
          }
          setSubmitting(false);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Suppliers</Text>
        <TouchableOpacity onPress={() => setShowAddForm(true)} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSuppliers(true)} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
        ) : suppliers.length === 0 ? (
          <Text style={styles.emptyText}>No suppliers found</Text>
        ) : suppliers.map((supplier) => (
          <View key={supplier.id} style={styles.farmerCard}>
            <View style={styles.farmerInfo}>
              <Text style={styles.farmerName}>{supplier.name}</Text>
              <Text style={styles.farmerDetail}>
                {supplier.supplier_type === 'farmer' ? 'Direct farmer' : 'Mediator'} · {supplier.location}
              </Text>
              <Text style={styles.farmerDetail}>{supplier.phone || 'No phone'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingId(supplier.id);
                setEditForm(supplierToForm(supplier));
              }}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <SupplierFormModal
        visible={showAddForm}
        mode="add"
        value={addForm}
        submitting={submitting}
        onChange={setAddForm}
        onSubmit={handleAdd}
        onClose={() => {
          setShowAddForm(false);
          setAddForm(emptySupplierForm);
        }}
      />

      <SupplierFormModal
        visible={editingId !== null}
        mode="edit"
        value={editForm}
        submitting={submitting}
        onChange={setEditForm}
        onSubmit={handleEdit}
        onDelete={handleDelete}
        onClose={() => {
          setEditingId(null);
          setEditForm(emptySupplierForm);
        }}
      />
    </View>
  );
}
