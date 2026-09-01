import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import ItemCatalogForm from '../catalog/ItemCatalogForm';
import { useItemCatalog } from '../catalog/useItemCatalog';
import styles from '../../styles/PurchaseScreen.styles';

type Props = {
  visible: boolean;
  onCreated: (itemCode: string) => Promise<void>;
  onClose: () => void;
};

export default function ItemCatalogCreateModal({ visible, onCreated, onClose }: Props) {
  const catalog = useItemCatalog();

  const save = async (input: Parameters<typeof catalog.save>[0]) => {
    const saved = await catalog.save(input);
    if (saved) {
      await onCreated(input.code);
      onClose();
    }
    return saved;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.catalogModalContainer}>
        <View style={styles.catalogModalHeader}>
          <Text style={styles.catalogModalTitle}>Create catalog item</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.sheetClose}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.catalogModalContent} keyboardShouldPersistTaps="handled">
          <ItemCatalogForm
            item={null}
            grades={catalog.grades}
            units={catalog.units}
            saving={catalog.saving}
            onSave={save}
            onCancel={onClose}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
