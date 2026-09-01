import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  archiveCatalogItem,
  getCatalogItems,
  getItemGrades,
  getUnits,
  isDuplicateCatalogItemError,
  saveCatalogItem,
} from '../../api/catalog';
import type { CatalogItem, CatalogItemInput, ItemGrade, UnitOfMeasure } from '../../types';

export function useItemCatalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [grades, setGrades] = useState<ItemGrade[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (asRefresh = false) => {
    asRefresh ? setRefreshing(true) : setLoading(true);

    try {
      const [catalogItems, catalogGrades, catalogUnits] = await Promise.all([
        getCatalogItems(),
        getItemGrades(),
        getUnits(),
      ]);
      setItems(catalogItems);
      setGrades(catalogGrades);
      setUnits(catalogUnits);
    } catch (error) {
      console.error('Unable to load item catalog:', error);
      Alert.alert('Unable to load catalog', 'Please check the connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (input: CatalogItemInput): Promise<boolean> => {
    const normalizedName = input.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const duplicateItem = items.find(
      (item) => item.id !== input.id
        && item.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName,
    );

    if (duplicateItem) {
      Alert.alert('Duplicate item', `${duplicateItem.name} already exists in the catalog.`);
      return false;
    }

    setSaving(true);
    try {
      await saveCatalogItem(input);
      await load();
      Alert.alert('Saved', `${input.name.trim()} and its grades are ready to use.`);
      return true;
    } catch (error) {
      console.error('Unable to save catalog item:', error);
      if (isDuplicateCatalogItemError(error)) {
        Alert.alert(
          'Duplicate item',
          'An item with the same name or generated code already exists, including archived items.',
        );
        return false;
      }
      Alert.alert(
        'Unable to save item',
        'Please check the item details and try again.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const archive = (item: CatalogItem) => {
    Alert.alert(
      'Archive item?',
      `${item.name} will disappear from new purchases and sales. Existing records remain unchanged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await archiveCatalogItem(item.id);
              await load();
            } catch (error) {
              console.error('Unable to archive catalog item:', error);
              Alert.alert('Unable to archive item', 'Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return {
    items,
    grades,
    units,
    loading,
    refreshing,
    saving,
    refresh: () => load(true),
    save,
    archive,
  };
}
