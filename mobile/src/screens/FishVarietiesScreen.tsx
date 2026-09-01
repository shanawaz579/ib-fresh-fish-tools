import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import ItemCatalogCard from '../features/catalog/ItemCatalogCard';
import ItemCatalogForm from '../features/catalog/ItemCatalogForm';
import ItemCatalogSearch from '../features/catalog/ItemCatalogSearch';
import { useItemCatalog } from '../features/catalog/useItemCatalog';
import styles from '../styles/ItemCatalog.styles';
import type { CatalogItem } from '../types';

export default function FishVarietiesScreen() {
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    items,
    grades,
    units,
    loading,
    refreshing,
    saving,
    refresh,
    save,
    archive,
  } = useItemCatalog();

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const searchableValues = [
        item.name,
        item.code,
        ...item.variants.flatMap((variant) => [
          variant.variant_code,
          variant.name,
          variant.grade_code,
          variant.grade_name,
        ]),
      ];

      return searchableValues.some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [items, searchQuery]);

  const saveAndClose = async (input: Parameters<typeof save>[0]) => {
    const saved = await save(input);
    if (saved) setEditingItem(null);
    return saved;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Item Catalog</Text>
        <Text style={styles.subtitle}>Fish items, grades, units and default crate estimates</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <ItemCatalogForm
          item={editingItem}
          grades={grades}
          units={units}
          saving={saving}
          onSave={saveAndClose}
          onCancel={() => setEditingItem(null)}
        />

        <Text style={styles.listTitle}>Active items</Text>
        <ItemCatalogSearch
          query={searchQuery}
          resultCount={filteredItems.length}
          totalCount={items.length}
          onChange={setSearchQuery}
        />
        {loading ? (
          <ActivityIndicator size="large" color="#0F766E" style={styles.loader} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No items yet. Create the first fish item above.</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No items match “{searchQuery.trim()}”.</Text>
          </View>
        ) : (
          filteredItems.map((item) => (
            <ItemCatalogCard
              key={item.id}
              item={item}
              disabled={saving}
              onEdit={setEditingItem}
              onArchive={archive}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
