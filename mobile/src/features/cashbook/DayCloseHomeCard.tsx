import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { DayCloseReadiness } from '../../types';

type Props = { readiness: DayCloseReadiness | null; onPress: () => void };

export default function DayCloseHomeCard({ readiness, onPress }: Props) {
  const status = readiness?.status ?? 'ready';
  const title = status === 'closed' ? 'Today is closed' : status === 'blocked' ? 'Day close needs attention' : 'Ready for day close';
  const detail = !readiness
    ? 'Open cashbook and review today’s operations'
    : status === 'closed'
      ? 'Transactions are locked and auditable'
      : status === 'blocked'
        ? `${readiness.blocker_count} blocking ${readiness.blocker_count === 1 ? 'item' : 'items'} to resolve`
        : readiness.warning_count > 0
          ? `${readiness.warning_count} credit ${readiness.warning_count === 1 ? 'warning' : 'warnings'} — closing is allowed`
          : 'Operations are reconciled and ready';

  return (
    <TouchableOpacity onPress={onPress} style={[homeStyles.card, status === 'blocked' ? homeStyles.blocked : status === 'closed' ? homeStyles.closed : homeStyles.ready]}>
      <View style={homeStyles.icon}><Text style={homeStyles.iconText}>{status === 'blocked' ? '!' : status === 'closed' ? '✓' : '→'}</Text></View>
      <View style={homeStyles.copy}><Text style={homeStyles.eyebrow}>TODAY · BUSINESS CONTROL</Text><Text style={homeStyles.title}>{title}</Text><Text style={homeStyles.detail}>{detail}</Text></View>
      <Text style={homeStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const homeStyles = {
  card: { alignItems: 'center' as const, borderRadius: 16, borderWidth: 1, flexDirection: 'row' as const, marginBottom: 13, padding: 14 },
  ready: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  blocked: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  closed: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  icon: { alignItems: 'center' as const, backgroundColor: '#0F172A', borderRadius: 12, height: 40, justifyContent: 'center' as const, width: 40 },
  iconText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' as const },
  copy: { flex: 1, marginLeft: 11 },
  eyebrow: { color: '#64748B', fontSize: 7, fontWeight: '900' as const, letterSpacing: 0.8 },
  title: { color: '#0F172A', fontSize: 14, fontWeight: '900' as const, marginTop: 2 },
  detail: { color: '#64748B', fontSize: 9, marginTop: 3 },
  chevron: { color: '#475569', fontSize: 26, marginLeft: 8 },
};
