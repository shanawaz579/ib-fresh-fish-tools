import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { addCustomer, deleteCustomer, getCustomers, updateCustomer } from '../../api/stock';
import type { Customer } from '../../types';

export interface CustomerFormData {
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
  name: '', phone: '', email: '', address: '', city: '', state: '',
  contact_person: '', business_type: '', notes: '',
};

export function useCustomersManagement() {
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

  const closeAddForm = () => {
    setShowAddForm(false);
    setFormData(initialFormData);
  };

  return {
    customers, loading, refreshing, formData, setFormData, submitting,
    editingId, editingData, setEditingData, showAddForm, setShowAddForm,
    onRefresh, handleAddCustomer, handleStartEdit, handleSaveEdit, handleDelete, handleCancelEdit, closeAddForm,
  };
}
