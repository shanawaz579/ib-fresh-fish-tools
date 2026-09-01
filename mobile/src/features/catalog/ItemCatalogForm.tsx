import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { generateItemCode } from '../../api/catalog';
import type {
  CatalogItem,
  CatalogItemInput,
  ItemGrade,
  UnitOfMeasure,
} from '../../types';
import styles from '../../styles/ItemCatalog.styles';
import { useBusinessConfig } from '../../context/BusinessConfigContext';

type Props = {
  item: CatalogItem | null;
  grades: ItemGrade[];
  units: UnitOfMeasure[];
  saving: boolean;
  onSave: (input: CatalogItemInput) => Promise<boolean>;
  onCancel: () => void;
};

export default function ItemCatalogForm({
  item,
  grades,
  units,
  saving,
  onSave,
  onCancel,
}: Props) {
  const { configuration } = useBusinessConfig();
  const configuredCrateWeight = configuration.preferences.default_crate_weight_kg;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [primaryUnit, setPrimaryUnit] = useState('CRATE');
  const [secondaryUnit, setSecondaryUnit] = useState('KG');
  const [inventoryUnit, setInventoryUnit] = useState('KG');
  const [defaultKgPerCrate, setDefaultKgPerCrate] = useState(String(configuredCrateWeight));
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    setName(item?.name ?? '');
    setCode(item?.code ?? '');
    setSelectedGrades(
      item ? item.variants.map((variant) => variant.grade_code).filter(Boolean) as string[] : grades.map((grade) => grade.code),
    );
    setPrimaryUnit(item?.primary_unit.code ?? 'CRATE');
    setSecondaryUnit(item?.secondary_unit?.code ?? 'KG');
    setInventoryUnit(item?.inventory_unit.code ?? 'KG');
    setDefaultKgPerCrate(String(item?.default_kg_per_crate ?? configuredCrateWeight));
    setValidationMessage('');
  }, [configuredCrateWeight, item, grades]);

  const updateName = (value: string) => {
    setName(value);
    if (!item) setCode(generateItemCode(value));
  };

  const toggleGrade = (gradeCode: string) => {
    setSelectedGrades((current) =>
      current.includes(gradeCode)
        ? current.filter((codeValue) => codeValue !== gradeCode)
        : [...current, gradeCode],
    );
  };

  const submit = async () => {
    const conversion = Number(defaultKgPerCrate);

    if (!name.trim() || !code.trim()) {
      setValidationMessage('Item name and code are required.');
      return;
    }
    if (selectedGrades.length === 0) {
      setValidationMessage('Select at least one grade.');
      return;
    }
    if (primaryUnit === secondaryUnit) {
      setValidationMessage('Primary and secondary units must be different.');
      return;
    }
    if (primaryUnit === 'CRATE' && secondaryUnit === 'KG' && conversion <= 0) {
      setValidationMessage('Default kilograms per crate must be greater than zero.');
      return;
    }

    setValidationMessage('');
    const saved = await onSave({
      id: item?.id,
      name,
      code,
      gradeCodes: selectedGrades,
      primaryUnitCode: primaryUnit,
      secondaryUnitCode: secondaryUnit,
      inventoryUnitCode: inventoryUnit,
      defaultKgPerCrate: conversion,
    });

    if (saved && !item) {
      setName('');
      setCode('');
      setSelectedGrades(grades.map((grade) => grade.code));
      setDefaultKgPerCrate(String(configuredCrateWeight));
    }
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.sectionTitle}>{item ? `Edit ${item.name}` : 'Add item'}</Text>

      <Text style={styles.label}>Item name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={updateName}
        placeholder="Example: Pangasius"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Item code</Text>
      <View style={styles.readOnlyField}>
        <Text style={code ? styles.readOnlyValue : styles.readOnlyPlaceholder}>
          {code || 'Generated from the item name'}
        </Text>
      </View>
      <Text style={styles.helperText}>
        Used for variant codes, reports and future integrations. It remains stable when the item name changes.
      </Text>

      <Text style={styles.label}>Available grades</Text>
      <View style={styles.gradeRow}>
        {grades.map((grade) => {
          const selected = selectedGrades.includes(grade.code);
          return (
            <TouchableOpacity
              key={grade.id}
              style={[styles.gradeChip, selected && styles.gradeChipSelected]}
              onPress={() => toggleGrade(grade.code)}
            >
              <Text style={[styles.gradeChipText, selected && styles.gradeChipTextSelected]}>
                {grade.code}
              </Text>
              <Text style={[styles.gradeChipLabel, selected && styles.gradeChipTextSelected]}>
                {grade.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.unitRow}>
        <View style={styles.unitField}>
          <Text style={styles.label}>Primary entry unit</Text>
          <View style={styles.pickerFrame}>
            <Picker selectedValue={primaryUnit} onValueChange={setPrimaryUnit}>
              {units.map((unit) => (
                <Picker.Item key={unit.id} label={unit.name} value={unit.code} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.unitField}>
          <Text style={styles.label}>Secondary unit</Text>
          <View style={styles.pickerFrame}>
            <Picker selectedValue={secondaryUnit} onValueChange={setSecondaryUnit}>
              {units.map((unit) => (
                <Picker.Item key={unit.id} label={unit.name} value={unit.code} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <Text style={styles.label}>Inventory base unit</Text>
      <View style={styles.pickerFrame}>
        <Picker selectedValue={inventoryUnit} onValueChange={setInventoryUnit}>
          {units.map((unit) => (
            <Picker.Item key={unit.id} label={unit.name} value={unit.code} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Default kilograms per crate</Text>
      <TextInput
        style={styles.input}
        value={defaultKgPerCrate}
        onChangeText={setDefaultKgPerCrate}
        keyboardType="decimal-pad"
        placeholder="35"
      />
      <Text style={styles.helperText}>
        Used to estimate full-crate weight. Additional kilograms are recorded separately on purchases.
      </Text>

      {validationMessage ? <Text style={styles.validationText}>{validationMessage}</Text> : null}

      <View style={styles.formActions}>
        {item ? (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.saveButton} onPress={submit} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : item ? 'Save changes' : 'Create item'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
