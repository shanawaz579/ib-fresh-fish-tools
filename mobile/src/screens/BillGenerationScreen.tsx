import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import DateNavigator from '../components/DateNavigator';
import BillCustomerPanel from '../features/customerBilling/BillCustomerPanel';
import BillItemRateCard from '../features/customerBilling/BillItemRateCard';
import BillReviewPanel from '../features/customerBilling/BillReviewPanel';
import CustomerBillPreview from '../features/customerBilling/CustomerBillPreview';
import GeneratedBillsList from '../features/customerBilling/GeneratedBillsList';
import BillCorrectionModal from '../components/BillCorrectionModal';
import { useCustomerBilling } from '../features/customerBilling/useCustomerBilling';
import { releaseCustomerBillForCorrection } from '../api/stock';
import type { Bill } from '../types';
import { formatBusinessDate } from '../utils/date';
import styles from '../styles/BillGenerationScreen.styles';

export default function BillGenerationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const billing = useCustomerBilling();
  const scrollRef = useRef<ScrollView>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const existingBill = billing.selectedCustomerId
    ? billing.bills.find(bill => bill.customer_id === billing.selectedCustomerId && bill.bill_date === billing.date && bill.id !== billing.editingBillId)
    : undefined;
  const canEnterRates = Boolean(billing.selectedCustomerId && !existingBill);

  const handleNewBill = () => {
    billing.resetForm();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleDeleteBill = async (reason: string) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await releaseCustomerBillForCorrection(deleteTarget.id, reason);
      setDeleteTarget(null);
      billing.resetForm();
      await billing.loadData();
      Alert.alert('Bill deleted', 'The bill remains in correction history and its sales are available for billing again.');
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : 'Please try again.';
      Alert.alert(message.includes('Void active receipts') ? 'Payment must be voided first' : 'Unable to delete bill', message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Go back" style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CUSTOMER SALES</Text>
          <Text style={styles.title}>{billing.editingBillId ? 'Edit bill' : 'Create bill'}</Text>
        </View>
        {billing.editingBillId ? <TouchableOpacity style={styles.cancelEdit} onPress={billing.resetForm}><Text style={styles.cancelEditText}>Cancel</Text></TouchableOpacity> : null}
      </View>

      <DateNavigator date={billing.date} onPrevious={billing.goToPreviousDay} onNext={billing.goToNextDay} onToday={billing.goToToday} accentColor="#0F766E" />

      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <BillCustomerPanel
          customers={billing.customers}
          selectedCustomer={billing.selectedCustomer}
          existingBill={existingBill}
          totalOutstanding={billing.customerOutstanding.total_outstanding}
          unpaidBillsCount={billing.customerOutstanding.unpaid_bills_count}
          oldestBillDate={billing.customerOutstanding.oldest_bill_date}
          onSelect={billing.handleCustomerSelect}
          onCreated={billing.handleCustomerCreated}
          onViewExisting={billing.handleViewBill}
          onEditExisting={billing.handleEditBill}
        />

        {canEnterRates ? (
          <View style={styles.itemsSection}>
            <View style={styles.stepHeading}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
              <View style={styles.stepCopy}><Text style={styles.stepTitle}>Set item rates</Text><Text style={styles.stepSubtitle}>{billing.billItems.length ? `${billing.billItems.length} item${billing.billItems.length === 1 ? '' : 's'} sold on ${formatBusinessDate(billing.date)}` : 'Sales from the selected date appear here'}</Text></View>
            </View>

            {billing.loadingItems ? (
              <View style={styles.loadingState}><ActivityIndicator color="#0F766E" /><Text style={styles.loadingText}>Loading sold items…</Text></View>
            ) : billing.billItems.length ? billing.billItems.map((item, index) => (
              <BillItemRateCard
                key={`${item.fish_variety_id}-${index}`}
                item={item}
                amount={billing.calculateItemAmount(item)}
                onChangeCrateWeight={value => billing.updateItemField(index, 'crate_weight', value)}
                onChangeRate={value => billing.updateItemField(index, 'rate_per_kg', value)}
              />
            )) : (
              <View style={styles.emptyState}><Text style={styles.emptyTitle}>No unbilled sales</Text><Text style={styles.emptyText}>There are no items to bill for this customer on {formatBusinessDate(billing.date)}.</Text></View>
            )}
          </View>
        ) : !billing.selectedCustomerId ? (
          <View style={styles.startHint}><Text style={styles.startHintIcon}>↑</Text><Text style={styles.startHintText}>Select a customer to load their sold items</Text></View>
        ) : null}

        {canEnterRates && !billing.loadingItems && billing.billItems.length > 0 ? (
          <BillReviewPanel
            previousBalance={billing.previewBalanceDue}
            itemsTotal={billing.itemsTotal}
            chargesTotal={billing.chargesTotal}
            currentBillTotal={billing.currentBillTotal}
            quickPaymentsTotal={billing.quickPaymentsTotal}
            total={billing.total}
            otherCharges={billing.otherCharges}
            onChargesChange={billing.setOtherCharges}
            quickPayments={billing.quickPayments}
            newPaymentAmount={billing.newPaymentAmount}
            onPaymentAmountChange={billing.setNewPaymentAmount}
            newPaymentMethod={billing.newPaymentMethod}
            onPaymentMethodChange={billing.setNewPaymentMethod}
            onAddPayment={billing.handleAddQuickPayment}
            onRemovePayment={billing.handleRemoveQuickPayment}
            notes={billing.notes}
            onNotesChange={billing.setNotes}
            markAsPaid={billing.markAsPaid}
            onMarkAsPaidChange={billing.setMarkAsPaid}
            submitting={billing.submitting}
            editing={Boolean(billing.editingBillId)}
            correctionReason={billing.correctionReason}
            onCorrectionReasonChange={billing.setCorrectionReason}
            allRatesSet={billing.billItems.every(item => item.rate_per_kg > 0)}
            onSubmit={billing.handleGenerateBill}
          />
        ) : null}

        <GeneratedBillsList bills={billing.bills} customers={billing.customers} loading={billing.loading} onView={billing.handleViewBill} onEdit={billing.handleEditBill} onDelete={setDeleteTarget} onAdd={handleNewBill} />
      </ScrollView>

      <CustomerBillPreview visible={billing.showPreview} bill={billing.previewBill} customerName={billing.previewCustomerName} onClose={() => billing.setShowPreview(false)} onPrint={billing.handlePrintBill} onShare={billing.handleShareBill} />

      <BillCorrectionModal
        visible={Boolean(deleteTarget)}
        billNumber={deleteTarget?.bill_number}
        documentLabel="sales bill"
        action="delete"
        saving={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteBill}
      />

    </View>
  );
}
