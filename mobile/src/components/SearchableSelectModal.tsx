import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from '../styles/PurchaseScreen.styles';

export type SearchableOption = {
  id: number;
  label: string;
  detail?: string;
  searchText?: string;
};

type Props = {
  visible: boolean;
  title: string;
  searchPlaceholder: string;
  options: SearchableOption[];
  emptyMessage: string;
  createLabel?: string;
  onSelect: (id: number) => void;
  onCreate?: () => void;
  onClose: () => void;
};

export default function SearchableSelectModal(props: Props) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!props.visible) setQuery('');
  }, [props.visible]);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return props.options;
    return props.options.filter((option) =>
      `${option.label} ${option.detail ?? ''} ${option.searchText ?? ''}`
        .toLocaleLowerCase()
        .includes(normalized));
  }, [props.options, query]);

  const close = () => {
    setQuery('');
    props.onClose();
  };

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{props.title}</Text>
            <TouchableOpacity onPress={close} hitSlop={8}>
              <Text style={styles.sheetClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={props.searchPlaceholder}
            autoFocus
            autoCorrect={false}
          />
          {props.onCreate ? (
            <TouchableOpacity style={styles.sheetCreateButton} onPress={props.onCreate}>
              <Text style={styles.sheetCreateText}>{props.createLabel ?? '+ Create new'}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.resultMeta}>{filteredOptions.length} result{filteredOptions.length === 1 ? '' : 's'}</Text>
          <FlatList
            data={filteredOptions}
            keyExtractor={(option) => String(option.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.sheetEmptyText}>{props.emptyMessage}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => {
                  props.onSelect(item.id);
                  close();
                }}
              >
                <Text style={styles.optionLabel}>{item.label}</Text>
                {item.detail ? <Text style={styles.optionDetail}>{item.detail}</Text> : null}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
