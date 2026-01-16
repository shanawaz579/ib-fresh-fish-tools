import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  getFishVarieties,
  addFishVariety,
  updateFishVariety,
  deleteFishVariety,
} from '../api/stock';
import type { FishVariety } from '../types';

export default function FishVarietiesScreen() {
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadVarieties();
  }, []);

  const loadVarieties = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const data = await getFishVarieties();
    setVarieties(data);

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadVarieties(true);
  };

  const handleAddVariety = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter fish variety name');
      return;
    }

    setSubmitting(true);
    const result = await addFishVariety(newName);

    if (result) {
      setNewName('');
      await loadVarieties();
      Alert.alert('Success', 'Fish variety added successfully!');
    } else {
      Alert.alert('Error', 'Failed to add fish variety. Name might already exist.');
    }
    setSubmitting(false);
  };

  const handleStartEdit = (variety: FishVariety) => {
    setEditingId(variety.id);
    setEditingName(variety.name);
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim()) {
      Alert.alert('Error', 'Please enter fish variety name');
      return;
    }

    if (editingId === null) return;

    setSubmitting(true);
    const result = await updateFishVariety(editingId, editingName);

    if (result) {
      setEditingId(null);
      setEditingName('');
      await loadVarieties();
      Alert.alert('Success', 'Fish variety updated successfully!');
    } else {
      Alert.alert('Error', 'Failed to update fish variety. Name might already exist.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this fish variety?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            const result = await deleteFishVariety(id);
            if (result) {
              await loadVarieties();
              Alert.alert('Success', 'Fish variety deleted successfully!');
            } else {
              Alert.alert('Error', 'Failed to delete fish variety');
            }
            setSubmitting(false);
          },
        },
      ]
    );
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fish Varieties</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Add New Variety */}
        <View style={styles.addSection}>
          <Text style={styles.sectionTitle}>Add New Fish Variety</Text>
          <View style={styles.addForm}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fish Variety Name</Text>
              <TextInput
                style={styles.addInput}
                placeholder="Enter fish variety name"
                placeholderTextColor="#9CA3AF"
                value={newName}
                onChangeText={setNewName}
              />
            </View>
            <TouchableOpacity
              onPress={handleAddVariety}
              disabled={submitting}
              style={[styles.addButton, submitting && styles.disabledButton]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>Add</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Varieties List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>All Fish Varieties</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
          ) : varieties.length === 0 ? (
            <Text style={styles.emptyText}>No fish varieties found</Text>
          ) : (
            varieties.map((variety) => (
              <View key={variety.id} style={styles.varietyCard}>
                {editingId === variety.id ? (
                  // Edit Mode
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Fish Variety Name</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={styles.editInput}
                        placeholder="Enter fish variety name"
                        placeholderTextColor="#9CA3AF"
                        value={editingName}
                        onChangeText={setEditingName}
                        autoFocus
                      />
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          onPress={handleSaveEdit}
                          disabled={submitting}
                          style={[styles.saveButton, submitting && styles.disabledButton]}
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleCancelEdit}
                          style={styles.cancelButton}
                        >
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  // View Mode
                  <>
                    <Text style={styles.varietyName}>{variety.name}</Text>
                    <View style={styles.varietyActions}>
                      <TouchableOpacity
                        onPress={() => handleStartEdit(variety)}
                        style={styles.editButton}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(variety.id)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#3B82F6',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  addSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  addForm: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 16,
    marginTop: 20,
  },
  varietyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  varietyName: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  varietyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  editInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    color: '#111827',
    marginRight: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 4,
  },
});
