import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import SearchableSelectModal, { type SearchableOption } from '../components/SearchableSelectModal';
import { useItemActivity } from '../features/itemActivity/useItemActivity';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/ItemActivityScreen.styles';

export default function ItemsByCustomerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const activity = useItemActivity();
  const [showItems, setShowItems] = useState(false);
  const [showParties, setShowParties] = useState(false);
  const selectedItem = activity.varieties.find(item => item.id === activity.selectedVarietyId);
  const selectedParty = activity.parties.find(party => party.id === activity.selectedPartyId);
  const itemOptions = useMemo<SearchableOption[]>(() => activity.varieties.map(item => ({ id:item.id,label:item.name,group:item.item_name,detail:item.variant_code,searchText:[item.item_name,item.item_code,item.grade_code].filter(Boolean).join(' ') })), [activity.varieties]);
  const partyOptions = useMemo<SearchableOption[]>(() => [{ id:0,label:`All ${activity.mode === 'sales' ? 'customers' : 'suppliers'}` }, ...activity.parties.map(party => ({ id:party.id,label:party.name }))], [activity.mode, activity.parties]);
  const quantity = (crates:number, kg:number) => [crates ? `${crates} cr` : '', kg ? `${kg} kg` : ''].filter(Boolean).join(' · ') || '0';

  return <View style={styles.container}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Text style={styles.backText}>←</Text></TouchableOpacity><View><Text style={styles.title}>Item activity</Text><Text style={styles.subtitle}>See who bought or supplied each item</Text></View></View>
    <DateNavigator date={activity.date} onPrevious={activity.goToPreviousDay} onNext={activity.goToNextDay} onToday={activity.goToToday} accentColor="#0F766E" />
    <ScrollView refreshControl={<RefreshControl refreshing={activity.refreshing} onRefresh={activity.refresh} />} contentContainerStyle={styles.content}>
      <View style={styles.tabs}>{(['sales','purchases'] as const).map(mode => <TouchableOpacity key={mode} style={[styles.tab,activity.mode===mode&&styles.tabActive]} onPress={() => activity.selectMode(mode)}><Text style={[styles.tabText,activity.mode===mode&&styles.tabTextActive]}>{mode==='sales'?'Sales':'Purchases'}</Text></TouchableOpacity>)}</View>
      {activity.quickVarietyIds.length ? <View><Text style={styles.quickLabel}>QUICK ITEMS</Text><View style={styles.quickRow}>{activity.quickVarietyIds.map(id => { const item=activity.varieties.find(row=>row.id===id); return item?<TouchableOpacity key={id} style={[styles.quickChip,id===activity.selectedVarietyId&&styles.quickChipActive]} onPress={()=>activity.setSelectedVarietyId(id)}><Text style={[styles.quickText,id===activity.selectedVarietyId&&styles.quickTextActive]} numberOfLines={1}>{item.variant_code||item.name}</Text></TouchableOpacity>:null; })}</View></View>:null}
      <View style={styles.filters}>
        <TouchableOpacity style={styles.filter} onPress={()=>setShowItems(true)}><Text style={styles.filterLabel}>ITEM & GRADE</Text><Text style={selectedItem?styles.filterValue:styles.filterPlaceholder}>{selectedItem?.name??'Choose an item'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.filter} onPress={()=>setShowParties(true)}><Text style={styles.filterLabel}>{activity.mode==='sales'?'CUSTOMER':'SUPPLIER'}</Text><Text style={styles.filterValue}>{selectedParty?.name??`All ${activity.mode==='sales'?'customers':'suppliers'}`}</Text></TouchableOpacity>
      </View>
      {activity.loading?<ActivityIndicator color="#0F766E" style={styles.loader}/>:!activity.selectedVarietyId?<View style={styles.empty}><Text style={styles.emptyIcon}>↟</Text><Text style={styles.emptyTitle}>Choose an item</Text><Text style={styles.emptyText}>Select an item to see its {activity.mode==='sales'?'customer':'supplier'} activity.</Text></View>:<>
        <View style={styles.summary}>
          <View style={styles.summaryMetric}><Text style={styles.summaryLabel}>AVAILABLE / TOTAL CRATES</Text><Text style={styles.summaryValue}>{activity.stockSummary.availableCrates} / {activity.stockSummary.totalCrates} cr</Text></View>
          <View style={[styles.summaryMetric,styles.summaryMetricBorder]}><Text style={styles.summaryLabel}>AVAILABLE / TOTAL KG</Text><Text style={styles.summaryValue}>{activity.stockSummary.availableKg} / {activity.stockSummary.totalKg} kg</Text></View>
          <View style={[styles.summaryMetric,styles.summaryMetricBorder,styles.summaryRight]}><Text style={styles.summaryLabel}>{activity.mode==='sales'?'CUSTOMERS':'SUPPLIERS'}</Text><Text style={styles.summaryCount}>{activity.partySummaries.length}</Text></View>
        </View>
        <Text style={styles.sectionTitle}>{activity.mode==='sales'?'Customer breakdown':'Supplier breakdown'}</Text>
        {activity.partySummaries.map(party=><TouchableOpacity key={party.id} style={styles.partyRow} onPress={()=>activity.setSelectedPartyId(party.id)}><View style={styles.partyInitial}><Text style={styles.partyInitialText}>{party.name.slice(0,1).toUpperCase()}</Text></View><View style={styles.partyCopy}><Text style={styles.partyName}>{party.name}</Text><Text style={styles.partyMeta}>{party.lines} transaction{party.lines===1?'':'s'}</Text></View><Text style={styles.partyQuantity}>{quantity(party.crates,party.kg)}</Text></TouchableOpacity>)}
        {!activity.partySummaries.length?<Text style={styles.noRows}>No matching activity for this date.</Text>:null}
        <Text style={styles.sectionTitle}>Transactions</Text>
        {activity.rows.map(row=><View key={row.id} style={styles.transaction}><View><Text style={styles.transactionParty}>{row.partyName}</Text><Text style={styles.transactionStatus}>{row.status}</Text></View><Text style={styles.transactionQty}>{quantity(row.crates,row.kg)}</Text></View>)}
      </>}
    </ScrollView>
    <SearchableSelectModal visible={showItems} title="Select item and grade" searchPlaceholder="Search item, code or grade" options={itemOptions} emptyMessage="No activity items found" onSelect={id=>activity.setSelectedVarietyId(Number(id))} onClose={()=>setShowItems(false)}/>
    <SearchableSelectModal visible={showParties} title={activity.mode==='sales'?'Filter customer':'Filter supplier'} searchPlaceholder="Search name" options={partyOptions} emptyMessage="No parties found" onSelect={id=>activity.setSelectedPartyId(Number(id)||null)} onClose={()=>setShowParties(false)}/>
  </View>;
}
