import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BRAND_COLORS } from '../config/brandTheme';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import type { AccountOverview } from '../domain/accountLedger';

type Props = {
  accounts: AccountOverview[];
  loading: boolean;
  accountLabel: string;
  onSelect: (accountId: number) => void;
};

export default function AccountOverviewList({ accounts, loading, accountLabel, onSelect }: Props) {
  const { formatMoney } = useBusinessConfig();
  const [search, setSearch] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(true);
  const totals = useMemo(() => accounts.reduce((sum, account) => ({
    billed: sum.billed + account.totalBilled,
    paid: sum.paid + account.totalPaid,
    due: sum.due + account.outstandingAmount,
    credit: sum.credit + account.advanceCredit,
  }), { billed: 0, paid: 0, due: 0, credit: 0 }), [accounts]);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return accounts.filter(account =>
      (!outstandingOnly || account.outstandingAmount > 0)
      && (!query || account.accountName.toLocaleLowerCase().includes(query)),
    );
  }, [accounts, outstandingOnly, search]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={BRAND_COLORS.primary} /><Text style={styles.loadingText}>Loading accounts…</Text></View>;

  return (
    <View>
      <View style={styles.summary}>
        <View><Text style={styles.summaryLabel}>BILLED</Text><Text style={styles.summaryValue}>{formatMoney(totals.billed, 0)}</Text></View>
        <View><Text style={styles.summaryLabel}>PAID</Text><Text style={styles.summaryPaid}>{formatMoney(totals.paid, 0)}</Text></View>
        <View style={styles.alignRight}><Text style={styles.summaryLabel}>OUTSTANDING</Text><Text style={styles.summaryDue}>{formatMoney(totals.due, 0)}</Text></View>
      </View>
      {totals.credit > 0 ? <Text style={styles.creditNote}>Advance credit: {formatMoney(totals.credit, 0)}</Text> : null}
      <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder={`Search ${accountLabel.toLocaleLowerCase()}`} placeholderTextColor="#94A3B8" />
      <TouchableOpacity style={[styles.filter, outstandingOnly && styles.filterOn]} onPress={() => setOutstandingOnly(value => !value)}>
        <Text style={[styles.filterText, outstandingOnly && styles.filterTextOn]}>Outstanding only</Text>
      </TouchableOpacity>
      {visible.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>No matching {accountLabel.toLocaleLowerCase()}</Text><Text style={styles.emptyText}>Change the search or show all accounts.</Text></View>
      ) : visible.map(account => (
        <TouchableOpacity key={account.accountId} style={styles.card} onPress={() => onSelect(account.accountId)}>
          <View style={styles.initial}><Text style={styles.initialText}>{account.accountName.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.copy}><Text style={styles.name} numberOfLines={1}>{account.accountName}</Text><Text style={styles.meta}>Paid {formatMoney(account.totalPaid, 0)} of {formatMoney(account.totalBilled, 0)}</Text></View>
          <View style={styles.amountWrap}>
            <Text style={[styles.amount, account.advanceCredit > 0 && styles.credit]}>{account.advanceCredit > 0 ? formatMoney(account.advanceCredit, 0) : formatMoney(account.outstandingAmount, 0)}</Text>
            <Text style={styles.amountLabel}>{account.advanceCredit > 0 ? 'advance' : account.outstandingAmount > 0 ? 'due' : 'clear'} ›</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', padding: 30 }, loadingText: { color: BRAND_COLORS.muted, marginLeft: 8 },
  summary: { backgroundColor: BRAND_COLORS.ink, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', padding: 15 }, summaryLabel: { color: '#94A3B8', fontSize: 8, fontWeight: '900', letterSpacing: .5 }, summaryValue: { color: '#FFF', fontSize: 13, fontWeight: '800', marginTop: 4 }, summaryPaid: { color: '#6EE7B7', fontSize: 13, fontWeight: '800', marginTop: 4 }, summaryDue: { color: '#FDBA74', fontSize: 13, fontWeight: '800', marginTop: 4 }, alignRight: { alignItems: 'flex-end' }, creditNote: { color: '#2563EB', fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'right' },
  search: { backgroundColor: '#FFF', borderColor: BRAND_COLORS.border, borderRadius: 11, borderWidth: 1, color: BRAND_COLORS.ink, height: 44, marginTop: 12, paddingHorizontal: 12 }, filter: { alignSelf: 'flex-start', backgroundColor: '#E9EEF0', borderRadius: 9, marginVertical: 9, paddingHorizontal: 11, paddingVertical: 8 }, filterOn: { backgroundColor: BRAND_COLORS.primary }, filterText: { color: '#475569', fontSize: 11, fontWeight: '800' }, filterTextOn: { color: '#FFF' },
  empty: { alignItems: 'center', backgroundColor: '#FFF', borderColor: BRAND_COLORS.border, borderRadius: 13, borderWidth: 1, padding: 22 }, emptyTitle: { color: '#334155', fontSize: 14, fontWeight: '800' }, emptyText: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  card: { alignItems: 'center', backgroundColor: '#FFF', borderColor: BRAND_COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', marginBottom: 8, padding: 11 }, initial: { alignItems: 'center', backgroundColor: BRAND_COLORS.primarySoftStrong, borderRadius: 9, height: 38, justifyContent: 'center', width: 38 }, initialText: { color: BRAND_COLORS.primary, fontSize: 15, fontWeight: '900' }, copy: { flex: 1, marginLeft: 10 }, name: { color: BRAND_COLORS.ink, fontSize: 14, fontWeight: '800' }, meta: { color: BRAND_COLORS.muted, fontSize: 10, marginTop: 2 }, amountWrap: { alignItems: 'flex-end' }, amount: { color: '#C2410C', fontSize: 14, fontWeight: '900' }, credit: { color: '#2563EB' }, amountLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '700', marginTop: 2 },
});
