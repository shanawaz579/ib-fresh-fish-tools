import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SearchableSelectModal, { type SearchableOption } from '../../components/SearchableSelectModal';
import type { FishVariety } from '../../types';
import styles from '../../styles/SalesScreen.styles';

type EditItem = { id: number; varietyId: number; varietyName: string; crates: number; kg: number };

type Props = {
  customerName: string;
  items: EditItem[];
  varieties: FishVariety[];
  submitting: boolean;
  onCancel: () => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onChange: (index: number, field: 'varietyId' | 'crates' | 'kg', value: number | string) => void;
  onSave: () => void;
};

export default function SalesGroupEditCard(props: Props) {
  const [selectingIndex, setSelectingIndex] = useState<number | null>(null);
  const options = useMemo<SearchableOption[]>(() => props.varieties.map((variant) => ({
    id: variant.id,
    label: variant.name,
    detail: variant.variant_code,
    searchText: [variant.item_name, variant.grade_code].filter(Boolean).join(' '),
  })), [props.varieties]);

  return (
    <View style={[styles.customerGroup, styles.editMode]}>
      <View style={styles.editHeader}>
        <View><Text style={styles.editTitle}>{props.customerName}</Text><Text style={styles.editSubtitle}>Editing unbilled sale</Text></View>
        <TouchableOpacity onPress={props.onCancel} style={styles.cancelEditButton}><Text style={styles.cancelEditText}>Cancel</Text></TouchableOpacity>
      </View>

      {props.items.map((item, index) => (
        <View key={item.id || `new-${index}`} style={styles.editItemContainer}>
          <TouchableOpacity style={styles.editSelectField} onPress={() => setSelectingIndex(index)}>
            <Text style={item.varietyId ? styles.selectValue : styles.selectPlaceholder}>{item.varietyName || 'Search item and grade'}</Text>
            <Text style={styles.selectChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.editRow}>
            <TextInput style={styles.editInput} placeholder="Crates" keyboardType="number-pad" value={String(item.crates)} onChangeText={(value) => props.onChange(index, 'crates', value)} />
            <TextInput style={styles.editInput} placeholder="Kg" keyboardType="decimal-pad" value={String(item.kg)} onChangeText={(value) => props.onChange(index, 'kg', value)} />
            <TouchableOpacity onPress={() => props.onRemoveItem(index)} style={styles.removeEditButton}><Text style={styles.removeEditText}>×</Text></TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.editActions}>
        <TouchableOpacity onPress={props.onAddItem} style={styles.addVarietyButton}><Text style={styles.addVarietyText}>+ Add item</Text></TouchableOpacity>
        <TouchableOpacity onPress={props.onSave} disabled={props.submitting} style={[styles.saveChangesButton, props.submitting && styles.submitButtonDisabled]}>
          {props.submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveChangesText}>Save changes</Text>}
        </TouchableOpacity>
      </View>

      <SearchableSelectModal
        visible={selectingIndex !== null}
        title="Select item and grade"
        searchPlaceholder="Search item, code or grade"
        options={options}
        emptyMessage="No active catalog item found"
        onSelect={(id) => {
          if (selectingIndex !== null) props.onChange(selectingIndex, 'varietyId', id);
        }}
        onClose={() => setSelectingIndex(null)}
      />
    </View>
  );
}
