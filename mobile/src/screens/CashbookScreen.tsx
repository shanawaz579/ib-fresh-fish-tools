import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import CashAdjustmentForm from '../features/cashbook/CashAdjustmentForm';
import CashbookEntries from '../features/cashbook/CashbookEntries';
import CashbookReasonModal from '../features/cashbook/CashbookReasonModal';
import CashbookSummaryCard from '../features/cashbook/CashbookSummaryCard';
import CashClosingCard from '../features/cashbook/CashClosingCard';
import CashFlowBreakdown from '../features/cashbook/CashFlowBreakdown';
import DayCloseChecklist from '../features/cashbook/DayCloseChecklist';
import { useCashbook } from '../features/cashbook/useCashbook';
import type { RootStackParamList } from '../navigation/AppNavigator';
import styles from '../styles/CashbookScreen.styles';
import { toLocalDateString } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'Cashbook'>;
type ReasonAction = { type: 'adjustment'; id: number } | { type: 'reopen' } | null;

export default function CashbookScreen({ navigation }: Props) {
  const cashbook = useCashbook();
  const { configuration, formatMoney } = useBusinessConfig();
  const [reasonAction, setReasonAction] = useState<ReasonAction>(null);
  const isClosed = cashbook.day.is_closed;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backIcon}>‹</Text></TouchableOpacity>
        <View><Text style={styles.eyebrow}>DAILY FINANCE</Text><Text style={styles.title}>Cashbook</Text></View>
      </View>
      <DateNavigator date={cashbook.date} onPrevious={cashbook.goToPreviousDay} onNext={cashbook.goToNextDay} onToday={cashbook.goToToday} canGoNext={cashbook.date < toLocalDateString()} accentColor="#334155" />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <CashbookSummaryCard day={cashbook.day} loading={cashbook.loading} formatMoney={formatMoney} />
        <DayCloseChecklist readiness={cashbook.readiness} loading={cashbook.loading} formatMoney={formatMoney} />
        {!cashbook.loading && !isClosed && cashbook.day.expected_closing_cash < 0 ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Starting cash is missing</Text>
            <Text style={styles.warningText}>Add a Cash In adjustment for the opening cash balance, or correct the underlying cash entries. The day cannot close with negative expected cash.</Text>
          </View>
        ) : null}
        <CashFlowBreakdown day={cashbook.day} formatMoney={formatMoney} />
        {!isClosed ? <CashAdjustmentForm currencySymbol={configuration.preferences.currency_symbol} submitting={cashbook.submitting} onSave={cashbook.addAdjustment} /> : null}
        <CashClosingCard day={cashbook.day} currencySymbol={configuration.preferences.currency_symbol} submitting={cashbook.submitting} formatMoney={formatMoney} onClose={cashbook.closeDay} onRequestReopen={() => setReasonAction({ type: 'reopen' })} canClose={cashbook.readiness.can_close} blockerCount={cashbook.readiness.blocker_count} />
        <CashbookEntries entries={cashbook.entries} isClosed={isClosed} formatMoney={formatMoney} onVoidAdjustment={(id) => setReasonAction({ type: 'adjustment', id })} />
      </ScrollView>
      <CashbookReasonModal
        visible={reasonAction !== null}
        title={reasonAction?.type === 'reopen' ? 'Reopen cash day' : 'Void adjustment'}
        message={reasonAction?.type === 'reopen' ? 'Reopening unlocks all business transactions for this date and preserves the previous closing in audit history.' : 'The adjustment will remain visible in the audit trail.'}
        submitting={cashbook.submitting}
        onClose={() => setReasonAction(null)}
        onConfirm={(reason) => reasonAction?.type === 'reopen' ? cashbook.reopenDay(reason) : reasonAction?.type === 'adjustment' ? cashbook.voidAdjustment(reasonAction.id, reason) : Promise.resolve(false)}
      />
    </View>
  );
}
