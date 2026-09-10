import styles from '../styles/PackingScreen.styles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Share,
  Switch,
} from 'react-native';
import {
  clearPackingStatusByDate,
  createPackingShare,
  getCustomers,
  getPackingStatusByDate,
  getSalesByDate,
  revokePackingShares,
  togglePackingStatus,
} from '../api/stock';
import type { Sale } from '../types';
import { useAuth } from '../context/AuthContext';
import { useBusinessDate } from '../hooks/useBusinessDate';
import { addDays, formatBusinessDate, toLocalDateString } from '../utils/date';
import { useNavigation } from '@react-navigation/native';
import { extractFishSize } from '../domain/fish';

interface PackingItem {
  saleId: number;
  fishVarietyName: string;
  quantityCrates: number;
  quantityKg: number;
}

interface CustomerGroup {
  customerId: number;
  customerName: string;
  items: PackingItem[];
  totalCrates: number;
  totalKg: number;
}

const PACKING_GRADE_ORDER = ['OB', 'B', 'M', 'S'];

function sortPackingItems(items: PackingItem[]) {
  const groupTotals = items.reduce((groups, item) => {
    const fishName = extractFishSize(item.fishVarietyName).name.toLocaleLowerCase();
    const current = groups.get(fishName) ?? { crates: 0, kg: 0 };
    current.crates += item.quantityCrates;
    current.kg += item.quantityKg;
    groups.set(fishName, current);
    return groups;
  }, new Map<string, { crates: number; kg: number }>());

  items.sort((a, b) => {
    const aFish = extractFishSize(a.fishVarietyName);
    const bFish = extractFishSize(b.fishVarietyName);
    const aKey = aFish.name.toLocaleLowerCase();
    const bKey = bFish.name.toLocaleLowerCase();
    const aTotal = groupTotals.get(aKey) ?? { crates: 0, kg: 0 };
    const bTotal = groupTotals.get(bKey) ?? { crates: 0, kg: 0 };

    if (aKey !== bKey) {
      return bTotal.crates - aTotal.crates || bTotal.kg - aTotal.kg || aFish.name.localeCompare(bFish.name);
    }

    const aGrade = PACKING_GRADE_ORDER.indexOf(aFish.size);
    const bGrade = PACKING_GRADE_ORDER.indexOf(bFish.size);
    return (aGrade === -1 ? PACKING_GRADE_ORDER.length : aGrade)
      - (bGrade === -1 ? PACKING_GRADE_ORDER.length : bGrade)
      || a.fishVarietyName.localeCompare(b.fishVarietyName)
      || a.saleId - b.saleId;
  });
}

const translations = {
  en: {
    title: 'Packing List',
    customer: 'Customer',
    crates: 'cr',
    loaded: 'Loaded',
    noSales: 'No sales to pack for this day',
    logout: 'Logout',
    inProgress: 'In Progress',
    completed: 'Completed',
  },
};

export default function PackingScreen() {
  const navigation = useNavigation();
  const { signOut, user, isAdmin, isPacker } = useAuth();
  const { date, setDate } = useBusinessDate();
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedItems, setLoadedItems] = useState<Set<number>>(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState<Set<number>>(new Set());
  const [completedSectionExpanded, setCompletedSectionExpanded] = useState(false);
  const [shareDialogVisible, setShareDialogVisible] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(new Set());
  const [allowSharedUpdates, setAllowSharedUpdates] = useState(true);
  const [creatingShare, setCreatingShare] = useState(false);

  const t = translations.en;

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [salesData, packingStatusMap, customersData] = await Promise.all([
      getSalesByDate(date),
      getPackingStatusByDate(date),
      getCustomers(),
    ]);
    // Update loadedItems state from database
    setLoadedItems(new Set(
      Array.from(packingStatusMap.entries())
        .filter(([_, loaded]) => loaded)
        .map(([saleId, _]) => saleId)
    ));

    // Group sales by customer
    const grouped = salesData.reduce((acc: { [key: number]: CustomerGroup }, sale: Sale) => {
      const customerId = sale.customer_id;

      if (!acc[customerId]) {
        acc[customerId] = {
          customerId,
          customerName: sale.customer_name || 'Unknown Customer',
          items: [],
          totalCrates: 0,
          totalKg: 0,
        };
      }

      acc[customerId].items.push({
        saleId: sale.id,
        fishVarietyName: sale.fish_variety_name || 'Unknown Fish',
        quantityCrates: sale.quantity_crates,
        quantityKg: sale.quantity_kg,
      });

      acc[customerId].totalCrates += sale.quantity_crates;
      acc[customerId].totalKg += sale.quantity_kg;

      return acc;
    }, {});

    Object.values(grouped).forEach(group => sortPackingItems(group.items));

    // Sort customer groups: Wholesale Market first, then others, both sorted by quantity descending.
    const sortedGroups = Object.values(grouped).sort((a, b) => {
      const customerA = customersData.find(c => c.id === a.customerId);
      const customerB = customersData.find(c => c.id === b.customerId);

      const isWholesaleA = customerA?.business_type === 'Wholesale Market';
      const isWholesaleB = customerB?.business_type === 'Wholesale Market';

      // Wholesale Market customers come first
      if (isWholesaleA && !isWholesaleB) return -1;
      if (!isWholesaleA && isWholesaleB) return 1;

      // Largest packing jobs first.
      return b.totalCrates - a.totalCrates || b.totalKg - a.totalKg;
    });

    setCustomerGroups(sortedGroups);

    if (isRefreshing) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const toggleLoaded = async (saleId: number) => {
    const currentlyLoaded = loadedItems.has(saleId);
    const newLoadedState = !currentlyLoaded;

    // Optimistically update UI
    setLoadedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });

    // Save to database
    const success = await togglePackingStatus(saleId, newLoadedState, user?.email || '');

    if (!success) {
      // Revert on failure
      setLoadedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(saleId)) {
          newSet.delete(saleId);
        } else {
          newSet.add(saleId);
        }
        return newSet;
      });
      Alert.alert('Error', 'Failed to update packing status');
    }
  };

  const toggleCustomerExpanded = (customerId: number) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const isCustomerCompleted = (group: CustomerGroup) => {
    return group.items.every(item => loadedItems.has(item.saleId));
  };

  const today = toLocalDateString();
  const yesterday = addDays(today, -1);
  const inProgressGroups = customerGroups.filter(group => !isCustomerCompleted(group));
  const completedGroups = customerGroups.filter(isCustomerCompleted);
  const packedLines = customerGroups.reduce((total, group) => total + group.items.filter(item => loadedItems.has(item.saleId)).length, 0);
  const totalLines = customerGroups.reduce((total, group) => total + group.items.length, 0);
  const formatQuantity = (crates: number, kg: number) => [crates > 0 ? `${crates} cr` : '', kg > 0 ? `${kg} kg` : ''].filter(Boolean).join(' · ') || '0';

  const handleLogout = () => {
    Alert.alert(
      t.logout,
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: t.logout, style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const handleResetPackingStatus = () => {
    Alert.alert(
      'Reset Packing Status',
      'This will clear all loaded checkmarks for this day. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const success = await clearPackingStatusByDate(date);
            if (success) {
              setLoadedItems(new Set());
              loadData(true);
            } else {
              Alert.alert('Error', 'Failed to reset packing status');
            }
          },
        },
      ]
    );
  };

  const openShareDialog = () => {
    if (date !== today) {
      Alert.alert('Share today only', 'Temporary packing links can only be created for today.');
      return;
    }

    setSelectedCustomerIds(new Set(customerGroups.map(group => group.customerId)));
    setAllowSharedUpdates(true);
    setShareDialogVisible(true);
  };

  const toggleSharedCustomer = (customerId: number) => {
    setSelectedCustomerIds(current => {
      const next = new Set(current);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const toggleAllSharedCustomers = () => {
    setSelectedCustomerIds(current => (
      current.size === customerGroups.length
        ? new Set()
        : new Set(customerGroups.map(group => group.customerId))
    ));
  };

  const handleCreatePackingShare = async () => {
    if (selectedCustomerIds.size === 0) {
      Alert.alert('Select customers', 'Select at least one customer to share.');
      return;
    }

    setCreatingShare(true);
    try {
      const share = await createPackingShare(date, Array.from(selectedCustomerIds), allowSharedUpdates);
      setShareDialogVisible(false);
      await Share.share({
        title: `Packing list — ${formatBusinessDate(date)}`,
        message: `Packing list for ${formatBusinessDate(date)}\n${share.url}\n\nThis private link expires automatically.`,
        url: share.url,
      });
    } catch (error) {
      console.error('Unable to create packing link:', error);
      Alert.alert('Unable to share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setCreatingShare(false);
    }
  };

  const handleRevokePackingShares = () => {
    Alert.alert(
      'Revoke packing link?',
      'Anyone using the current link will lose access immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const revoked = await revokePackingShares(date);
              setShareDialogVisible(false);
              Alert.alert(revoked > 0 ? 'Link revoked' : 'No active link', revoked > 0 ? 'The packing link no longer works.' : 'There was no active link for today.');
            } catch (error) {
              console.error('Unable to revoke packing link:', error);
              Alert.alert('Unable to revoke', 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          {!isPacker && navigation.canGoBack() ? <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backText}>←</Text></TouchableOpacity> : null}
          <View><Text style={styles.title}>{t.title}</Text><Text style={styles.subtitle}>Prepare and confirm customer loads</Text></View>
        </View>
        <View style={styles.headerButtons}>
          {isAdmin ? (
            <TouchableOpacity onPress={openShareDialog} style={styles.shareButton}>
              <Text style={styles.shareText}>Share</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={handleResetPackingStatus} style={styles.resetButton}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          {isPacker ? <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>{t.logout}</Text>
          </TouchableOpacity> : null}
        </View>
      </View>

      <View style={styles.daySelector}>
        <TouchableOpacity style={[styles.dayOption, date === today && styles.dayOptionActive]} onPress={() => setDate(today)}><Text style={[styles.dayOptionText, date === today && styles.dayOptionTextActive]}>Today</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.dayOption, date === yesterday && styles.dayOptionActive]} onPress={() => setDate(yesterday)}><Text style={[styles.dayOptionText, date === yesterday && styles.dayOptionTextActive]}>Yesterday</Text></TouchableOpacity>
        <Text style={styles.selectedDate}>{formatBusinessDate(date)}</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} tintColor="#3B82F6" />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
        ) : customerGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t.noSales}</Text>
          </View>
        ) : (
          <>
            <View style={styles.progressCard}>
              <View><Text style={styles.progressLabel}>PACKING PROGRESS</Text><Text style={styles.progressValue}>{packedLines} of {totalLines} items loaded</Text></View>
              <View style={styles.progressCount}><Text style={styles.progressCountValue}>{inProgressGroups.length}</Text><Text style={styles.progressCountLabel}>PENDING</Text></View>
            </View>
            {/* In Progress Section */}
            {inProgressGroups.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t.inProgress}</Text><Text style={styles.sectionMeta}>{inProgressGroups.length} customers</Text>
                </View>
                {customerGroups.map((group) => {
                  if (isCustomerCompleted(group)) return null;

                  const isExpanded = expandedCustomers.has(group.customerId);

                  return (
                    <View
                      key={`progress-${group.customerId}`}
                      style={styles.customerCard}
                    >
                      <TouchableOpacity
                        style={styles.customerHeader}
                        onPress={() => toggleCustomerExpanded(group.customerId)}
                      >
                        <Text style={styles.customerName}>
                          {group.customerName}
                        </Text>
                        <Text style={styles.customerTotal}>
                          {formatQuantity(group.totalCrates, group.totalKg)}
                        </Text>
                        <Text style={styles.expandIcon}>
                          {isExpanded ? '▼' : '▶'}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && group.items.map((item) => (
                        <View key={item.saleId} style={styles.itemCard}>
                          <Text style={styles.fishName}>{item.fishVarietyName}</Text>
                          <Text style={styles.boxCount}>{formatQuantity(item.quantityCrates, item.quantityKg)}</Text>
                          <TouchableOpacity
                            style={[
                              styles.checkbox,
                              loadedItems.has(item.saleId) && styles.checkboxChecked
                            ]}
                            onPress={() => toggleLoaded(item.saleId)}
                          >
                            {loadedItems.has(item.saleId) && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            )}

            {/* Completed Section */}
            {completedGroups.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => setCompletedSectionExpanded(!completedSectionExpanded)}
                >
                  <Text style={styles.sectionTitle}>
                    ✓ {t.completed} ({completedGroups.length})
                  </Text>
                  <Text style={styles.sectionExpandIcon}>
                    {completedSectionExpanded ? '▼' : '▶'}
                  </Text>
                </TouchableOpacity>

                {completedSectionExpanded && customerGroups.map((group) => {
                  if (!isCustomerCompleted(group)) return null;

                  const isExpanded = expandedCustomers.has(group.customerId);

                  return (
                    <View
                      key={`completed-${group.customerId}`}
                      style={[
                        styles.customerCard,
                        styles.completedCard,
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.customerHeader,
                          styles.completedHeader,
                        ]}
                        onPress={() => toggleCustomerExpanded(group.customerId)}
                      >
                        <Text style={styles.customerName}>
                          {group.customerName}
                        </Text>
                        <Text style={styles.customerTotal}>
                          {formatQuantity(group.totalCrates, group.totalKg)}
                        </Text>
                        <Text style={styles.expandIcon}>
                          {isExpanded ? '▼' : '▶'}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && group.items.map((item) => (
                        <View key={item.saleId} style={[styles.itemCard, styles.completedItem]}>
                          <Text style={[styles.fishName, styles.completedText]}>{item.fishVarietyName}</Text>
                          <Text style={[styles.boxCount, styles.completedText]}>{formatQuantity(item.quantityCrates, item.quantityKg)}</Text>
                          <TouchableOpacity
                            style={[styles.checkbox, styles.checkboxChecked]}
                            onPress={() => toggleLoaded(item.saleId)}
                          >
                            <Text style={styles.checkmark}>✓</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={shareDialogVisible}
        onRequestClose={() => setShareDialogVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.shareSheet}>
            <View style={styles.shareSheetHandle} />
            <View style={styles.shareSheetHeader}>
              <View style={styles.shareSheetTitleBlock}>
                <Text style={styles.shareSheetEyebrow}>TEMPORARY TEAM ACCESS</Text>
                <Text style={styles.shareSheetTitle}>Share packing list</Text>
                <Text style={styles.shareSheetSubtitle}>Choose the customer loads visible to today’s packing team.</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShareDialogVisible(false)}>
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.selectAllRow} onPress={toggleAllSharedCustomers}>
              <View style={[styles.selectBox, selectedCustomerIds.size === customerGroups.length && styles.selectBoxChecked]}>
                {selectedCustomerIds.size === customerGroups.length ? <Text style={styles.selectCheck}>✓</Text> : null}
              </View>
              <Text style={styles.selectAllLabel}>Select all customers</Text>
              <Text style={styles.selectionCount}>{selectedCustomerIds.size}/{customerGroups.length}</Text>
            </TouchableOpacity>

            <ScrollView style={styles.shareCustomerList} contentContainerStyle={styles.shareCustomerListContent}>
              {customerGroups.map(group => {
                const selected = selectedCustomerIds.has(group.customerId);
                return (
                  <TouchableOpacity key={group.customerId} style={[styles.shareCustomerRow, selected && styles.shareCustomerRowSelected]} onPress={() => toggleSharedCustomer(group.customerId)}>
                    <View style={[styles.selectBox, selected && styles.selectBoxChecked]}>
                      {selected ? <Text style={styles.selectCheck}>✓</Text> : null}
                    </View>
                    <Text style={styles.shareCustomerName}>{group.customerName}</Text>
                    <Text style={styles.shareCustomerQuantity}>{formatQuantity(group.totalCrates, group.totalKg)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sharePermissionRow}>
              <View style={styles.sharePermissionCopy}>
                <Text style={styles.sharePermissionTitle}>Allow packing updates</Text>
                <Text style={styles.sharePermissionSubtitle}>Workers can only mark selected items packed or unpacked.</Text>
              </View>
              <Switch
                value={allowSharedUpdates}
                onValueChange={setAllowSharedUpdates}
                trackColor={{ false: '#CBD5E1', true: '#FDBA74' }}
                thumbColor={allowSharedUpdates ? '#B45309' : '#F8FAFC'}
              />
            </View>

            <Text style={styles.shareExpiryNote}>The link expires automatically after 24 hours. Creating a new link revokes the previous one.</Text>

            <View style={styles.shareActions}>
              <TouchableOpacity style={styles.revokeLinkButton} onPress={handleRevokePackingShares} disabled={creatingShare}>
                <Text style={styles.revokeLinkText}>Revoke link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.createLinkButton, (creatingShare || selectedCustomerIds.size === 0) && styles.createLinkButtonDisabled]} onPress={handleCreatePackingShare} disabled={creatingShare || selectedCustomerIds.size === 0}>
                {creatingShare ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.createLinkText}>Create & share link</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
