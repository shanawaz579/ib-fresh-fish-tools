import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { addCustomer } from '../../api/stock';
import type { Customer } from '../../types';
import styles from '../../styles/SalesScreen.styles';

type Props = {
  visible: boolean;
  onCreated: (customer: Customer) => void;
  onClose: () => void;
};

export default function CustomerCreateModal({ visible, onCreated, onClose }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(''); setPhone(''); setCity(''); setBusinessType('');
  }, [visible]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Customer name required', 'Enter the customer or business name.');
      return;
    }
    setSaving(true);
    try {
      const customer = await addCustomer(name.trim(), phone.trim(), undefined, undefined, city.trim(), undefined, undefined, businessType);
      if (!customer) throw new Error('Customer may already exist');
      onCreated(customer);
      onClose();
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Check the details and try again.';
      Alert.alert('Unable to create customer', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={styles.createCustomerSheet}>
          <View style={styles.sheetHeader}>
            <View><Text style={styles.sheetTitle}>Create customer</Text><Text style={styles.sheetSubtitle}>Name is required; other details are optional</Text></View>
            <TouchableOpacity onPress={onClose}><Text style={styles.sheetCloseText}>Close</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Customer / business name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter name" autoCapitalize="words" />
            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
            <Text style={styles.label}>Area / city (optional)</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Area or city" />
            <Text style={styles.label}>Business type (optional)</Text>
            <View style={styles.businessPicker}>
              <Picker selectedValue={businessType} onValueChange={setBusinessType}>
                <Picker.Item label="Select type" value="" />
                <Picker.Item label="Wholesale Market" value="Wholesale Market" />
                <Picker.Item label="Retail Store" value="Retail Store" />
                <Picker.Item label="Restaurant / Hotel" value="Hotel/Restaurant" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>
            <TouchableOpacity style={[styles.saveAllButton, saving && styles.submitButtonDisabled]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveAllButtonText}>Create and select</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
