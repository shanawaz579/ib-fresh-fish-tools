import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SearchableSelectModal, { type SearchableOption } from '../../components/SearchableSelectModal';
import { getCustomerLocation } from '../../domain/customers';
import ItemCatalogCreateModal from '../purchases/ItemCatalogCreateModal';
import type { Customer, FishVariety } from '../../types';
import CustomerCreateModal from './CustomerCreateModal';
import styles from '../../styles/SalesScreen.styles';

type DraftItem = { varietyId: number; varietyName: string; crates: number; kg: number };

type Props = {
  customers: Customer[];
  varieties: FishVariety[];
  frequentVarietyIds: number[];
  customerId: number | null;
  varietyId: number | null;
  crates: string;
  kg: string;
  drafts: DraftItem[];
  submitting: boolean;
  editing: boolean;
  editingDraft: boolean;
  getStock: (id: number) => { available: { crates: number; kg: number } };
  onCustomerChange: (id: number | null) => void;
  onCustomerCreated: (customer: Customer) => void;
  onVarietyChange: (id: number | null) => void;
  onCratesChange: (value: string) => void;
  onKgChange: (value: string) => void;
  onCatalogCreated: (code: string) => Promise<void>;
  onEditDraft: (index: number) => void;
  onRemoveDraft: (index: number) => void;
  onAdd: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
};

export default function SalesEntryForm(props: Props) {
  const [showCustomers, setShowCustomers] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const selectedCustomer = props.customers.find((customer) => customer.id === props.customerId);
  const selectedVariant = props.varieties.find((variant) => variant.id === props.varietyId);
  const selectedStock = props.varietyId ? props.getStock(props.varietyId).available : null;
  const availableVarieties = props.varieties.filter((variant) => {
    const stock = props.getStock(variant.id).available;
    return stock.crates > 0 || stock.kg > 0;
  });
  const frequent = props.frequentVarietyIds
    .map((id) => availableVarieties.find((variant) => variant.id === id))
    .filter((variant): variant is FishVariety => Boolean(variant));

  const customerOptions = useMemo<SearchableOption[]>(() => props.customers.map((customer) => ({
    id: customer.id,
    label: customer.name,
    detail: [getCustomerLocation(customer), customer.phone].filter(Boolean).join(' · '),
  })), [props.customers]);
  const itemOptions = useMemo<SearchableOption[]>(() => availableVarieties.map((variant) => {
    const stock = props.getStock(variant.id).available;
    return {
      id: variant.id,
      label: variant.name,
      group: variant.item_name,
      detail: `${[stock.crates > 0 ? `${stock.crates} cr` : '', stock.kg > 0 ? `${stock.kg} kg` : ''].filter(Boolean).join(' · ')} available`,
      searchText: [variant.variant_code, variant.item_name, variant.grade_code].filter(Boolean).join(' '),
    };
  }), [availableVarieties, props]);

  return (
    <View style={styles.formContainer}>
      <View style={styles.formHeader}>
        <View><Text style={styles.formTitle}>{props.editing ? 'Edit sale' : 'New sale'}</Text>{props.editing ? <Text style={styles.editingHint}>Update the same form, then save changes</Text> : null}</View>
        {props.editing ? <TouchableOpacity onPress={props.onCancelEdit}><Text style={styles.cancelFormEdit}>Cancel</Text></TouchableOpacity> : selectedCustomer ? <TouchableOpacity onPress={() => props.onCustomerChange(null)}><Text style={styles.changeCustomerText}>Change customer</Text></TouchableOpacity> : null}
      </View>

      <Text style={styles.label}>Customer *</Text>
      <TouchableOpacity style={[styles.selectField, props.editing && styles.lockedField]} disabled={props.editing} onPress={() => setShowCustomers(true)}>
        <View style={styles.selectIdentity}><Text style={selectedCustomer ? styles.selectValue : styles.selectPlaceholder}>{selectedCustomer?.name ?? 'Search and select customer'}</Text>{selectedCustomer && getCustomerLocation(selectedCustomer) ? <Text style={styles.selectDetail}>{getCustomerLocation(selectedCustomer)}</Text> : null}</View>
        <Text style={styles.selectChevron}>›</Text>
      </TouchableOpacity>

      {selectedCustomer ? (
        <>
          {props.drafts.length > 0 ? (
            <View style={styles.tempItemsContainer}>
              <View style={styles.tempItemsHeader}>
                <Text style={styles.tempItemsTitle}>{props.editing ? 'Items in this sale' : 'Sale items'}</Text>
                <Text style={styles.tempItemCount}>{props.drafts.length} item{props.drafts.length === 1 ? '' : 's'}</Text>
              </View>
              {props.drafts.map((item, index) => (
                <View key={item.varietyId} style={styles.tempItem}>
                  <View style={styles.tempItemInfo}>
                    <Text style={styles.tempItemName}>{item.varietyName}</Text>
                    <Text style={styles.tempItemQty}>{[item.crates > 0 ? `${item.crates} cr` : '', item.kg > 0 ? `${item.kg} kg` : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <TouchableOpacity style={styles.editTempButton} onPress={() => props.onEditDraft(index)}>
                    <Text style={styles.editTempText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeTempButton} onPress={() => props.onRemoveDraft(index)}>
                    <Text style={styles.removeTempText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.subsectionTitle}>{props.editing ? 'Add another item' : 'Add item and grade'}</Text>
          {frequent.length > 0 ? <View style={styles.quickPickSection}><Text style={styles.quickPickTitle}>Quick picks</Text><View style={styles.quickPickRow}>{frequent.map((variant) => <TouchableOpacity key={variant.id} style={[styles.quickPickChip, props.varietyId === variant.id && styles.quickPickChipActive]} onPress={() => props.onVarietyChange(variant.id)}><Text style={[styles.quickPickText, props.varietyId === variant.id && styles.quickPickTextActive]} numberOfLines={1}>{variant.variant_code || variant.name}</Text></TouchableOpacity>)}</View></View> : null}
          <TouchableOpacity style={styles.selectField} onPress={() => setShowItems(true)}>
            <View style={styles.selectIdentity}><Text style={selectedVariant ? styles.selectValue : styles.selectPlaceholder}>{selectedVariant?.name ?? 'Search available stock'}</Text>{selectedStock ? <Text style={styles.selectDetail}>Available: {[selectedStock.crates > 0 ? `${selectedStock.crates} cr` : '', selectedStock.kg > 0 ? `${selectedStock.kg} kg` : ''].filter(Boolean).join(' · ')}</Text> : null}</View>
            <Text style={styles.selectChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={styles.inputContainer}><View style={styles.labelRow}><Text style={styles.label}>Crates</Text>{selectedStock ? <Text style={styles.availableText}>Avl {selectedStock.crates}</Text> : null}</View><TextInput style={styles.input} value={props.crates} onChangeText={props.onCratesChange} keyboardType="number-pad" placeholder="0" /></View>
            <View style={styles.inputContainer}><View style={styles.labelRow}><Text style={styles.label}>Kg</Text>{selectedStock ? <Text style={styles.availableText}>Avl {selectedStock.kg}</Text> : null}</View><TextInput style={styles.input} value={props.kg} onChangeText={props.onKgChange} keyboardType="decimal-pad" placeholder="0" /></View>
          </View>
          <Text style={styles.quantityHint}>Enter crates, kg, or both. At least one is required.</Text>
          <TouchableOpacity style={styles.addItemButton} onPress={props.onAdd}><Text style={styles.addItemButtonText}>{props.editingDraft ? 'Update item' : '+ Add to sale'}</Text></TouchableOpacity>

          <TouchableOpacity style={[styles.saveAllButton, styles.saleSubmitSpacing, (props.submitting || props.editingDraft || props.drafts.length === 0) && styles.submitButtonDisabled]} onPress={props.onSave} disabled={props.submitting || props.editingDraft || props.drafts.length === 0}>{props.submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveAllButtonText}>{props.editingDraft ? 'Update the item first' : props.editing ? `Save changes (${props.drafts.length})` : `Save sale (${props.drafts.length})`}</Text>}</TouchableOpacity>
        </>
      ) : null}

      <SearchableSelectModal visible={showCustomers} title="Select customer" searchPlaceholder="Search name, type, area or phone" options={customerOptions} emptyMessage="No customer found" createLabel="+ Create customer" onCreate={() => { setShowCustomers(false); setShowCreateCustomer(true); }} onSelect={props.onCustomerChange} onClose={() => setShowCustomers(false)} />
      <SearchableSelectModal visible={showItems} title="Select available item" searchPlaceholder="Search item, code or grade" options={itemOptions} emptyMessage="No available stock found" createLabel="+ Create catalog item" onCreate={() => { setShowItems(false); setShowCreateItem(true); }} onSelect={props.onVarietyChange} onClose={() => setShowItems(false)} />
      <CustomerCreateModal visible={showCreateCustomer} onCreated={props.onCustomerCreated} onClose={() => setShowCreateCustomer(false)} />
      <ItemCatalogCreateModal visible={showCreateItem} onCreated={props.onCatalogCreated} onClose={() => setShowCreateItem(false)} />
    </View>
  );
}
