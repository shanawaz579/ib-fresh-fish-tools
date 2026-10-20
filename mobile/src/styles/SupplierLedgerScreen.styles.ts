import { StyleSheet } from 'react-native';
import { BRAND_COLORS } from '../config/brandTheme';

export default StyleSheet.create({
  container: { backgroundColor: '#F5F7F8', flex: 1 },
  header: { alignItems: 'center', backgroundColor: BRAND_COLORS.primary, flexDirection: 'row', paddingBottom: 18, paddingHorizontal: 18, paddingTop: 48 },
  backButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,.14)', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  back: { color: '#FFF', fontSize: 30, fontWeight: '500', lineHeight: 32 },
  headerCopy: { marginLeft: 13 },
  eyebrow: { color: '#CCFBF1', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#FFF', fontSize: 25, fontWeight: '900', marginTop: 2 },
  content: { padding: 16, paddingBottom: 34 },
  allAccountsButton: { alignSelf: 'flex-start', marginBottom: 11, paddingVertical: 4 },
  allAccountsText: { color: BRAND_COLORS.primary, fontSize: 13, fontWeight: '900' },
  accountCard: { backgroundColor: '#FFF', borderColor: BRAND_COLORS.border, borderRadius: 15, borderWidth: 1, padding: 16 },
  accountName: { color: BRAND_COLORS.ink, fontSize: 20, fontWeight: '900' },
  asOf: { color: BRAND_COLORS.muted, fontSize: 10, marginTop: 3 },
  balanceRow: { alignItems: 'flex-end', borderTopColor: '#E2E8F0', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 13, paddingTop: 13 },
  balanceLabel: { color: BRAND_COLORS.muted, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  balanceValue: { color: '#C2410C', fontSize: 24, fontWeight: '900', marginTop: 3 },
  creditValue: { color: '#2563EB' },
  totals: { alignItems: 'flex-end' },
  totalText: { color: '#64748B', fontSize: 10, marginTop: 3 },
  hint: { backgroundColor: BRAND_COLORS.primarySoftStrong, borderRadius: 10, marginTop: 10, padding: 10 },
  hintText: { color: '#115E59', fontSize: 11, fontWeight: '700' },
  loadingText: { color: BRAND_COLORS.muted, padding: 28, textAlign: 'center' },
});
