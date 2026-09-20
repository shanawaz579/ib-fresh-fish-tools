import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import SearchableSelectModal, { type SearchableOption } from '../components/SearchableSelectModal';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import { useItemActivity, type ActivityRangeDays } from '../features/itemActivity/useItemActivity';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/ItemActivityScreen.styles';
import { formatBusinessDate } from '../utils/date';

export default function ItemsByCustomerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const terms = useBusinessConfig().configuration.preferences.terminology;
  const activity = useItemActivity();
  const [showItems, setShowItems] = useState(false);
  const [showParties, setShowParties] = useState(false);
  const selectedItem = activity.varieties.find(item => item.id === activity.selectedVarietyId);
  const selectedParty = activity.parties.find(party => party.id === activity.selectedPartyId);
  const partyWord = activity.mode === 'sales' ? terms.customer : terms.supplier;
  const itemOptions = useMemo<SearchableOption[]>(() => [{id:0,label:'All items'}, ...activity.varieties.map(item => ({id:item.id,label:item.name,group:item.item_name,detail:item.variant_code,searchText:[item.item_name,item.item_code,item.grade_code].filter(Boolean).join(' ')}))], [activity.varieties]);
  const partyOptions = useMemo<SearchableOption[]>(() => [{id:0,label:`All ${partyWord.toLowerCase()}s`}, ...activity.parties.map(party => ({id:party.id,label:party.name}))], [activity.parties, partyWord]);
  const quantity = (crates:number, kg:number) => [crates?`${crates} cr`:'',kg?`${kg} kg`:''].filter(Boolean).join(' · ')||'0';
  const breakdown = activity.selectedPartyId ? activity.itemSummaries : activity.partySummaries;
  const recentRows = activity.rows.slice(0, 20);

  return <View style={styles.container}>
    <View style={styles.header}><TouchableOpacity style={styles.back} onPress={()=>navigation.goBack()}><Text style={styles.backText}>←</Text></TouchableOpacity><View><Text style={styles.title}>Trade activity</Text><Text style={styles.subtitle}>Items and quantities by customer or supplier</Text></View></View>
    <ScrollView refreshControl={<RefreshControl refreshing={activity.refreshing} onRefresh={activity.refresh}/>} contentContainerStyle={styles.content}>
      <View style={styles.tabs}>{(['sales','purchases'] as const).map(mode=><TouchableOpacity key={mode} style={[styles.tab,activity.mode===mode&&styles.tabActive]} onPress={()=>activity.selectMode(mode)}><Text style={[styles.tabText,activity.mode===mode&&styles.tabTextActive]}>{mode==='sales'?'Customer sales':'Supplier purchases'}</Text></TouchableOpacity>)}</View>
      <Text style={styles.rangeLabel}>PERIOD</Text>
      <View style={styles.rangeRow}>{([1,7,30] as ActivityRangeDays[]).map(days=><TouchableOpacity key={days} style={[styles.rangeChip,activity.rangeDays===days&&styles.rangeChipActive]} onPress={()=>activity.selectRange(days)}><Text style={[styles.rangeText,activity.rangeDays===days&&styles.rangeTextActive]}>{days===1?'Today':`${days} days`}</Text></TouchableOpacity>)}</View>
      <Text style={styles.periodText}>{formatBusinessDate(activity.fromDate)} – {formatBusinessDate(activity.today)}</Text>
      <View style={styles.filters}>
        <TouchableOpacity style={styles.filter} onPress={()=>setShowParties(true)}><Text style={styles.filterLabel}>{partyWord.toUpperCase()}</Text><Text style={selectedParty?styles.filterValue:styles.filterPlaceholder}>{selectedParty?.name??`All ${partyWord.toLowerCase()}s`}</Text><Text style={styles.filterChevron}>›</Text></TouchableOpacity>
        <TouchableOpacity style={styles.filter} onPress={()=>setShowItems(true)}><Text style={styles.filterLabel}>ITEM (OPTIONAL)</Text><Text style={selectedItem?styles.filterValue:styles.filterPlaceholder}>{selectedItem?.name??'All items'}</Text><Text style={styles.filterChevron}>›</Text></TouchableOpacity>
      </View>
      {activity.loading?<ActivityIndicator color="#0F766E" style={styles.loader}/>:<>
        <View style={styles.summary}>
          <View style={styles.summaryMetric}><Text style={styles.summaryLabel}>CRATES</Text><Text style={styles.summaryValue}>{activity.totals.crates}</Text></View>
          <View style={[styles.summaryMetric,styles.summaryMetricBorder]}><Text style={styles.summaryLabel}>KG</Text><Text style={styles.summaryValue}>{activity.totals.kg}</Text></View>
          <View style={[styles.summaryMetric,styles.summaryMetricBorder]}><Text style={styles.summaryLabel}>ENTRIES</Text><Text style={styles.summaryValue}>{activity.totals.transactions}</Text></View>
          <View style={[styles.summaryMetric,styles.summaryMetricBorder,styles.summaryRight]}><Text style={styles.summaryLabel}>UNBILLED</Text><Text style={styles.summaryCount}>{activity.totals.unbilled}</Text></View>
        </View>
        {activity.selectedVarietyId?<View style={styles.stockCard}><Text style={styles.stockTitle}>CURRENT STOCK</Text><View style={styles.stockMetrics}><Text style={styles.stockValue}>{activity.stockSummary.availableCrates} / {activity.stockSummary.totalCrates} cr</Text><Text style={styles.stockValue}>{activity.stockSummary.availableKg} / {activity.stockSummary.totalKg} kg</Text></View><Text style={styles.stockHint}>Available / total received</Text></View>:null}
        {activity.rows.length?<>
          <Text style={styles.sectionTitle}>{activity.selectedPartyId?'Item breakdown':`${partyWord} breakdown`}</Text>
          {breakdown.map(row=><TouchableOpacity key={row.id} style={styles.partyRow} onPress={()=>activity.selectedPartyId?activity.setSelectedVarietyId(row.id):activity.setSelectedPartyId(row.id)}><View style={styles.partyInitial}><Text style={styles.partyInitialText}>{row.name.slice(0,1).toUpperCase()}</Text></View><View style={styles.partyCopy}><Text style={styles.partyName}>{row.name}</Text><Text style={styles.partyMeta}>{row.lines} entr{row.lines===1?'y':'ies'}</Text></View><Text style={styles.partyQuantity}>{quantity(row.crates,row.kg)}</Text></TouchableOpacity>)}
          <Text style={styles.sectionTitle}>Recent entries</Text>
          {activity.rows.length > recentRows.length ? <Text style={styles.recentHint}>Latest 20 shown. Choose a customer, supplier or item to narrow the list.</Text> : null}
          {recentRows.map(row=><View key={`${activity.mode}-${row.id}`} style={styles.transaction}><View style={styles.transactionCopy}><Text style={styles.transactionParty}>{activity.selectedPartyId?row.varietyName:row.partyName}</Text><Text style={styles.transactionMeta}>{formatBusinessDate(row.date)}{activity.selectedPartyId?'':` · ${row.varietyName}`} · {row.status}</Text></View><Text style={styles.transactionQty}>{quantity(row.crates,row.kg)}</Text></View>)}
        </>:<View style={styles.empty}><Text style={styles.emptyIcon}>⌕</Text><Text style={styles.emptyTitle}>No activity in this period</Text><Text style={styles.emptyText}>Try a longer period or clear a filter.</Text></View>}
      </>}
    </ScrollView>
    <SearchableSelectModal visible={showItems} title="Filter item and grade" searchPlaceholder="Search item, code or grade" options={itemOptions} emptyMessage="No activity items found" onSelect={id=>activity.setSelectedVarietyId(Number(id)||null)} onClose={()=>setShowItems(false)}/>
    <SearchableSelectModal visible={showParties} title={`Filter ${partyWord.toLowerCase()}`} searchPlaceholder="Search name" options={partyOptions} emptyMessage={`No ${partyWord.toLowerCase()} activity found`} onSelect={id=>activity.setSelectedPartyId(Number(id)||null)} onClose={()=>setShowParties(false)}/>
  </View>;
}
