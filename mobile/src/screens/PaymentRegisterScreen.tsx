import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import { paymentMethodLabel, type RegisterPaymentMethod } from '../domain/paymentRegister';
import { type DirectionFilter, type MethodFilter, usePaymentRegister } from '../features/payments/usePaymentRegister';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/PaymentRegisterScreen.styles';
import { useBusinessConfig } from '../context/BusinessConfigContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentRegister'>;

const directionOptions: Array<{ value: DirectionFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'paid', label: 'Paid' },
];

const methodOptions: Array<{ value: MethodFilter; label: string }> = [
  { value: 'all', label: 'All methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function PaymentRegisterScreen({ navigation }: Props) {
  const register = usePaymentRegister();
  const { formatMoney } = useBusinessConfig();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>FINANCE</Text>
          <Text style={styles.title}>Payment register</Text>
        </View>
      </View>

      <DateNavigator
        date={register.date}
        onPrevious={register.goToPreviousDay}
        onNext={register.goToNextDay}
        onToday={register.goToToday}
        accentColor="#4338CA"
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={register.refreshing} onRefresh={register.refresh} tintColor="#4338CA" />}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>RECEIVED</Text>
            <Text style={styles.receivedValue}>{formatMoney(register.totals.received, 0)}</Text>
          </View>
          <View style={[styles.summaryColumn, styles.summaryDivider]}>
            <Text style={styles.summaryLabel}>PAID</Text>
            <Text style={styles.paidValue}>{formatMoney(register.totals.paid, 0)}</Text>
          </View>
          <View style={[styles.summaryColumn, styles.summaryDivider]}>
            <Text style={styles.summaryLabel}>NET FLOW</Text>
            <Text style={[styles.netValue, register.totals.net < 0 && styles.negativeNet]}>{formatMoney(register.totals.net, 0)}</Text>
          </View>
        </View>

        <TextInput
          style={styles.searchInput}
          value={register.search}
          onChangeText={register.setSearch}
          placeholder="Search party, bill or reference"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.filterLabel}>PAYMENT FLOW</Text>
        <View style={styles.chipRow}>
          {directionOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, register.direction === option.value && styles.chipActive]}
              onPress={() => register.setDirection(option.value)}
            >
              <Text style={[styles.chipText, register.direction === option.value && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>METHOD</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodRow}>
          {methodOptions.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.methodChip, register.method === option.value && styles.methodChipActive]}
              onPress={() => register.setMethod(option.value)}
            >
              <Text style={[styles.methodText, register.method === option.value && styles.methodTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.listHeading}>
          <View>
            <Text style={styles.listTitle}>Transactions</Text>
            <Text style={styles.listSubtitle}>{register.totals.count} active payment{register.totals.count === 1 ? '' : 's'} in this view</Text>
          </View>
          <TouchableOpacity
            style={[styles.auditChip, register.includeVoided && styles.auditChipActive]}
            onPress={() => register.setIncludeVoided(value => !value)}
          >
            <Text style={[styles.auditText, register.includeVoided && styles.auditTextActive]}>
              {register.includeVoided ? 'Hide voided' : 'Show voided'}
            </Text>
          </TouchableOpacity>
        </View>

        {register.loading ? (
          <View style={styles.loading}><ActivityIndicator color="#4338CA" /><Text style={styles.loadingText}>Loading payments…</Text></View>
        ) : register.visibleEntries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>₹</Text>
            <Text style={styles.emptyTitle}>No matching payments</Text>
            <Text style={styles.emptyText}>Payments recorded for this date will appear here.</Text>
          </View>
        ) : register.visibleEntries.map(entry => (
          <View key={entry.key} style={[styles.paymentCard, entry.direction === 'received' ? styles.receivedCard : styles.paidCard, entry.voidedAt && styles.voidedCard]}>
            <View style={styles.paymentTopRow}>
              <View style={[styles.directionBadge, entry.direction === 'received' ? styles.receivedBadge : styles.paidBadge]}>
                <Text style={[styles.directionSymbol, entry.direction === 'received' ? styles.receivedSymbol : styles.paidSymbol]}>{entry.direction === 'received' ? '↓' : '↑'}</Text>
              </View>
              <View style={styles.paymentIdentity}>
                <Text style={[styles.partyName, entry.voidedAt && styles.struckText]} numberOfLines={1}>{entry.partyName}</Text>
                <Text style={styles.directionText}>{entry.direction === 'received' ? 'Customer receipt' : 'Supplier payment'}</Text>
              </View>
              <View style={styles.amountColumn}>
                <Text style={[styles.amount, entry.direction === 'received' ? styles.receivedAmount : styles.paidAmount, entry.voidedAt && styles.struckText]}>{formatMoney(entry.amount, 0)}</Text>
                {entry.voidedAt ? <Text style={styles.voidedLabel}>VOIDED</Text> : null}
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.methodBadge}><Text style={styles.methodBadgeText}>{paymentMethodLabel(entry.method as RegisterPaymentMethod)}</Text></View>
              {entry.billNumber ? <Text style={styles.metaText}>Bill {entry.billNumber}</Text> : <Text style={styles.metaText}>Account payment</Text>}
              {entry.referenceNumber ? <Text style={styles.metaText} numberOfLines={1}>Ref {entry.referenceNumber}</Text> : null}
            </View>
            {entry.notes ? <Text style={styles.notes} numberOfLines={2}>{entry.notes}</Text> : null}
            {entry.voidedAt ? <Text style={styles.voidReason}>Reason: {entry.voidReason || 'Not specified'}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
