import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from '../../styles/ItemCatalog.styles';

type Props = {
  query: string;
  resultCount: number;
  totalCount: number;
  onChange: (query: string) => void;
};

export default function ItemCatalogSearch({ query, resultCount, totalCount, onChange }: Props) {
  const hasQuery = query.trim().length > 0;

  return (
    <View style={styles.searchSection}>
      <View style={styles.searchFrame}>
        <TextInput
          value={query}
          onChangeText={onChange}
          placeholder="Search name, code or grade"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
          accessibilityLabel="Search item catalog"
        />
        {hasQuery ? (
          <TouchableOpacity
            onPress={() => onChange('')}
            style={styles.searchClearButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear catalog search"
          >
            <Text style={styles.searchClearText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.searchMeta}>
        {hasQuery ? `${resultCount} of ${totalCount} items` : `${totalCount} active items`}
      </Text>
    </View>
  );
}
