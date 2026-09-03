import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SearchableSelectModal, { type SearchableOption } from '../../components/SearchableSelectModal';
import type { FishVariety, Supplier, SupplierCreateInput } from '../../types';
import ItemCatalogCreateModal from './ItemCatalogCreateModal';
import SupplierCreateModal from './SupplierCreateModal';
import type { PurchaseDraftItem } from './usePurchaseRecords';
import styles from '../../styles/PurchaseScreen.styles';

type Props = {
  suppliers: Supplier[];
  varieties: FishVariety[];
  frequentVarietyIds: number[];
  supplierId: number | null;
  farmerName: string;
  location: string;
  fishVarietyId: number | null;
  quantityCrates: string;
  quantityKg: string;
  draftItems: PurchaseDraftItem[];
  submitting: boolean;
  onSupplierChange: (id: number | null) => void;
  onFarmerNameChange: (name: string) => void;
  onLocationChange: (value: string) => void;
  onVarietyChange: (id: number | null) => void;
  onCratesChange: (value: string) => void;
  onKgChange: (value: string) => void;
  onCreateSupplier: (input: SupplierCreateInput) => Promise<boolean>;
  onCatalogItemCreated: (itemCode: string) => Promise<void>;
  onAddItem: () => void;
  onEditItem: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onSave: () => void;
};

export default function PurchaseEntryForm(props: Props) {
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showSupplierCreate, setShowSupplierCreate] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showItemCreate, setShowItemCreate] = useState(false);

  const selectedSupplier = props.suppliers.find((supplier) => supplier.id === props.supplierId);
  const isDirectFarmer = selectedSupplier?.supplier_type === 'farmer';
  const selectedVariety = props.varieties.find((variant) => variant.id === props.fishVarietyId);
  const frequentVarieties = props.frequentVarietyIds
    .map((id) => props.varieties.find((variant) => variant.id === id))
    .filter((variant): variant is FishVariety => Boolean(variant));

  const supplierOptions = useMemo<SearchableOption[]>(() => props.suppliers.map((supplier) => ({
    id: supplier.id,
    label: supplier.name,
    detail: `${supplier.supplier_type === 'farmer' ? 'Direct farmer' : 'Mediator'} · ${[supplier.location, supplier.phone].filter(Boolean).join(' · ')}`,
    searchText: supplier.supplier_type,
  })), [props.suppliers]);

  const itemOptions = useMemo<SearchableOption[]>(() => props.varieties.map((variant) => ({
    id: variant.id,
    label: variant.name,
    group: variant.item_name,
    detail: variant.variant_code,
    searchText: [variant.item_name, variant.grade_code, variant.grade_name].filter(Boolean).join(' '),
  })), [props.varieties]);

  const createSupplier = async (input: SupplierCreateInput) => {
    setCreatingSupplier(true);
    const created = await props.onCreateSupplier(input);
    setCreatingSupplier(false);
    return created;
  };

  return (
    <View style={styles.formCard}>
      <Text style={styles.sectionTitle}>New purchase</Text>

      <Text style={styles.label}>Primary supplier — this party will be paid *</Text>
      <TouchableOpacity style={styles.selectField} onPress={() => setShowSupplierPicker(true)}>
        <View style={styles.selectIdentity}>
          <Text style={selectedSupplier ? styles.selectValue : styles.selectPlaceholder}>
            {selectedSupplier?.name ?? 'Search and select supplier'}
          </Text>
          {selectedSupplier ? (
            <Text style={styles.selectDetail}>
              {isDirectFarmer ? 'Direct farmer' : 'Mediator'} · {selectedSupplier.location}
            </Text>
          ) : null}
        </View>
        <Text style={styles.selectChevron}>›</Text>
      </TouchableOpacity>

      {isDirectFarmer ? (
        <View style={styles.directInfoCard}>
          <Text style={styles.directInfoTitle}>Direct harvest</Text>
          <Text style={styles.directInfoText}>{selectedSupplier?.name} is both the source farmer and bill payee.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Source farmer name *</Text>
          <TextInput
            style={styles.input}
            value={props.farmerName}
            onChangeText={props.onFarmerNameChange}
            placeholder="Enter farmer name"
            autoCapitalize="words"
          />
        </>
      )}

      <Text style={styles.label}>Farm / collection location (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.location}
        onChangeText={props.onLocationChange}
        placeholder="Village, farm or collection point"
      />

      <View style={styles.divider} />
      <Text style={styles.subsectionTitle}>Add item and grade</Text>
      {frequentVarieties.length > 0 ? (
        <View style={styles.frequentSection}>
          <Text style={styles.frequentTitle}>Frequently used</Text>
          <View style={styles.frequentGrid}>
            {frequentVarieties.map((variant) => {
              const selected = variant.id === props.fishVarietyId;
              return (
                <TouchableOpacity
                  key={variant.id}
                  style={[styles.frequentChip, selected && styles.frequentChipSelected]}
                  onPress={() => props.onVarietyChange(variant.id)}
                >
                  <Text style={[styles.frequentChipText, selected && styles.frequentChipTextSelected]} numberOfLines={1}>
                    {variant.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
      <TouchableOpacity style={styles.selectField} onPress={() => setShowItemPicker(true)}>
        <View style={styles.selectIdentity}>
          <Text style={selectedVariety ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
            {selectedVariety?.name ?? 'Search item or grade'}
          </Text>
          {selectedVariety?.variant_code ? (
            <Text style={styles.selectDetail}>{selectedVariety.variant_code}</Text>
          ) : null}
        </View>
        <Text style={styles.selectChevron}>›</Text>
      </TouchableOpacity>

      <View style={styles.quantityRow}>
        <View style={styles.fieldColumn}>
          <Text style={styles.label}>Crates</Text>
          <TextInput
            style={styles.input}
            value={props.quantityCrates}
            onChangeText={props.onCratesChange}
            placeholder="0"
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.fieldColumn}>
          <Text style={styles.label}>Kg</Text>
          <TextInput
            style={styles.input}
            value={props.quantityKg}
            onChangeText={props.onKgChange}
            placeholder="0"
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      <Text style={styles.quantityHint}>Enter crates, kg, or both. At least one is required.</Text>

      <TouchableOpacity style={styles.addItemButton} onPress={props.onAddItem}>
        <Text style={styles.addItemButtonText}>+ Add to purchase</Text>
      </TouchableOpacity>

      {props.draftItems.length > 0 ? (
        <View style={styles.draftList}>
          {props.draftItems.map((item, index) => (
            <View key={item.varietyId} style={styles.draftRow}>
              <View style={styles.draftIdentity}>
                <Text style={styles.draftName}>{item.varietyName}</Text>
                <Text style={styles.draftQuantity}>
                  {[
                    item.crates > 0 ? `${item.crates} cr` : '',
                    item.kg > 0 ? `${item.kg} kg` : '',
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => props.onEditItem(index)} hitSlop={8}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => props.onRemoveItem(index)} hitSlop={8}>
                <Text style={styles.deleteText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.saveButton, (props.submitting || props.draftItems.length === 0) && styles.disabledButton]}
        onPress={props.onSave}
        disabled={props.submitting || props.draftItems.length === 0}
      >
        {props.submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save purchase ({props.draftItems.length})</Text>
        )}
      </TouchableOpacity>

      <SearchableSelectModal
        visible={showSupplierPicker}
        title="Select primary supplier"
        searchPlaceholder="Search name, type, location or phone"
        options={supplierOptions}
        emptyMessage="No supplier found. Create one to continue."
        createLabel="+ Create supplier account"
        onSelect={props.onSupplierChange}
        onCreate={() => {
          setShowSupplierPicker(false);
          setShowSupplierCreate(true);
        }}
        onClose={() => setShowSupplierPicker(false)}
      />

      <SupplierCreateModal
        visible={showSupplierCreate}
        saving={creatingSupplier}
        onSave={createSupplier}
        onClose={() => setShowSupplierCreate(false)}
      />

      <SearchableSelectModal
        visible={showItemPicker}
        title="Select item and grade"
        searchPlaceholder="Search item, code or grade"
        options={itemOptions}
        emptyMessage="No catalog item matches this search."
        createLabel="+ Create catalog item"
        onSelect={props.onVarietyChange}
        onCreate={() => {
          setShowItemPicker(false);
          setShowItemCreate(true);
        }}
        onClose={() => setShowItemPicker(false)}
      />

      {showItemCreate ? (
        <ItemCatalogCreateModal
          visible
          onCreated={props.onCatalogItemCreated}
          onClose={() => setShowItemCreate(false)}
        />
      ) : null}
    </View>
  );
}
