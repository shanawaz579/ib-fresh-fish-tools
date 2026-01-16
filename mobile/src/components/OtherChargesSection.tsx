import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import type { BillOtherCharge } from '../types';

interface OtherChargesSectionProps {
  charges: BillOtherCharge[];
  onChargesChange: (charges: BillOtherCharge[]) => void;
}

export default function OtherChargesSection({ charges, onChargesChange }: OtherChargesSectionProps) {
  const [chargeType, setChargeType] = useState<'packing' | 'ice' | 'transport' | 'loading' | 'unloading' | 'other'>('packing');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleAddCharge = () => {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum)) {
      return;
    }

    const newCharge: BillOtherCharge = {
      charge_type: chargeType,
      description: description.trim() || undefined,
      amount: amountNum,
    };

    onChargesChange([...charges, newCharge]);

    // Reset form
    setDescription('');
    setAmount('');
  };

  const handleRemoveCharge = (index: number) => {
    onChargesChange(charges.filter((_, i) => i !== index));
  };

  const chargeTypeLabels = {
    packing: 'Packing',
    ice: 'Ice',
    transport: 'Transport',
    loading: 'Loading',
    unloading: 'Unloading',
    other: 'Other',
  };

  const totalCharges = charges.reduce((sum, charge) => sum + charge.amount, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Other Charges</Text>

      {/* Existing Charges List */}
      {charges.length > 0 && (
        <View style={styles.chargesList}>
          {charges.map((charge, index) => (
            <View key={index} style={styles.chargeItem}>
              <View style={styles.chargeInfo}>
                <Text style={styles.chargeType}>
                  {chargeTypeLabels[charge.charge_type]}
                </Text>
                {charge.description && (
                  <Text style={styles.chargeDescription}>{charge.description}</Text>
                )}
              </View>
              <View style={styles.chargeRight}>
                <Text style={[styles.chargeAmount, charge.amount < 0 && styles.negativeAmount]}>
                  {charge.amount > 0 ? '+' : ''}₹{charge.amount.toLocaleString('en-IN')}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveCharge(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Charges:</Text>
            <Text style={[styles.totalValue, totalCharges < 0 && styles.negativeAmount]}>
              {totalCharges > 0 ? '+' : ''}₹{totalCharges.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      )}

      {/* Add New Charge Form */}
      <View style={styles.addForm}>
        <Text style={styles.label}>Add Charge</Text>

        {/* Charge Type */}
        <View style={styles.row}>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={chargeType}
              onValueChange={setChargeType}
              style={styles.picker}
            >
              <Picker.Item label="Packing" value="packing" />
              <Picker.Item label="Ice" value="ice" />
              <Picker.Item label="Transport" value="transport" />
              <Picker.Item label="Loading" value="loading" />
              <Picker.Item label="Unloading" value="unloading" />
              <Picker.Item label="Other" value="other" />
            </Picker>
          </View>
        </View>

        {/* Description */}
        <TextInput
          style={styles.input}
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
        />

        {/* Amount and Add Button */}
        <View style={styles.amountRow}>
          <View style={styles.amountInputWrapper}>
            <Text style={styles.rupeeSymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
          <TouchableOpacity onPress={handleAddCharge} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          💡 Use negative amount for deductions (e.g., returns, damages)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  chargesList: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chargeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  chargeInfo: {
    flex: 1,
  },
  chargeType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  chargeDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  chargeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chargeAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#10B981',
  },
  negativeAmount: {
    color: '#DC2626',
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#D1D5DB',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#374151',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  addForm: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  row: {
    marginBottom: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  picker: {
    height: 50,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  amountInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  rupeeSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    padding: 10,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
});
