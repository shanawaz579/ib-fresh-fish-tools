import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateNavigator from '../components/DateNavigator';
import SearchableSelectModal from '../components/SearchableSelectModal';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import { filterExpenses, type ExpenseStatusFilter } from '../domain/expenses';
import ExpenseCategoryModal from '../features/expenses/ExpenseCategoryModal';
import ExpenseVoidModal from '../features/expenses/ExpenseVoidModal';
import { useExpenses } from '../features/expenses/useExpenses';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Expense, ExpensePaymentMethod } from '../types';
import { toLocalDateString } from '../utils/date';
import styles from '../styles/ExpensesScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Expenses'>;

const primaryMethods: Array<{ value: ExpensePaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank' },
];

const additionalMethods: Array<{ value: ExpensePaymentMethod; label: string }> = [
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const referencePlaceholders: Record<ExpensePaymentMethod, string> = {
  cash: 'Receipt or voucher number',
  upi: 'UPI transaction ID',
  bank_transfer: 'Bank transaction reference',
  cheque: 'Cheque number',
  other: 'Reference number',
};

export default function ExpensesScreen({ navigation }: Props) {
  const expense = useExpenses();
  const { configuration, formatMoney } = useBusinessConfig();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ExpenseStatusFilter>('active');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [showMoreMethods, setShowMoreMethods] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Expense | null>(null);
  const visibleExpenses = useMemo(
    () => filterExpenses(expense.expenses, query, status),
    [expense.expenses, query, status],
  );
  const digitalTotal = expense.summary.total - expense.summary.byMethod.cash;
  const currencySymbol = configuration.preferences.currency_symbol;
  const selectedCategory = expense.categories.find((category) => category.id === expense.categoryId);
  const categoryOptions = useMemo(
    () => expense.categories.map((category) => ({ id: category.id, label: category.name })),
    [expense.categories],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>OPERATING COSTS</Text>
          <Text style={styles.title}>Expenses</Text>
        </View>
      </View>

      <DateNavigator
        date={expense.date}
        onPrevious={expense.goToPreviousDay}
        onNext={expense.goToNextDay}
        onToday={expense.goToToday}
        canGoNext={expense.date < toLocalDateString()}
        accentColor="#C2410C"
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>TODAY'S ACTIVE EXPENSE</Text>
            <Text style={styles.summaryTotal}>{formatMoney(expense.summary.total, 2)}</Text>
          </View>
          <View style={styles.summaryMetrics}>
            <View><Text style={styles.metricLabel}>CASH</Text><Text style={styles.metricValue}>{formatMoney(expense.summary.byMethod.cash, 0)}</Text></View>
            <View><Text style={styles.metricLabel}>NON-CASH</Text><Text style={styles.metricValue}>{formatMoney(digitalTotal, 0)}</Text></View>
            <View><Text style={styles.metricLabel}>ENTRIES</Text><Text style={styles.metricValue}>{expense.summary.activeCount}</Text></View>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeading}>
            <View style={styles.formIcon}><Text style={styles.formIconText}>{currencySymbol}</Text></View>
            <View><Text style={styles.formTitle}>Record expense</Text><Text style={styles.formSubtitle}>Saved entries become part of the audit trail</Text></View>
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>CATEGORY *</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(true)}><Text style={styles.addCategory}>+ New category</Text></TouchableOpacity>
          </View>
          {expense.quickCategories.length > 0 ? (
            <View style={styles.quickCategorySection}>
              <Text style={styles.quickCategoryLabel}>QUICK ACCESS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCategoryRow}>
                {expense.quickCategories.map((category) => {
                  const selected = expense.categoryId === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[styles.quickCategoryChip, selected && styles.quickCategoryChipOn]}
                      onPress={() => expense.setCategoryId(category.id)}
                    >
                      <Text style={[styles.quickCategoryText, selected && styles.quickCategoryTextOn]} numberOfLines={1}>{category.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.categorySelect}
            onPress={() => setShowCategorySelector(true)}
            accessibilityRole="button"
            accessibilityLabel="Select expense category"
          >
            <View style={styles.categorySelectCopy}>
              <Text style={styles.categorySelectHint}>SELECTED CATEGORY</Text>
              <Text style={[styles.categorySelectValue, !selectedCategory && styles.categorySelectPlaceholder]} numberOfLines={1}>
                {selectedCategory?.name ?? 'Choose a category'}
              </Text>
            </View>
            <Text style={styles.categorySelectChevron}>⌄</Text>
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>AMOUNT *</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.currency}>{currencySymbol}</Text>
            <TextInput style={styles.amountInput} value={expense.amount} onChangeText={expense.setAmount} keyboardType="decimal-pad" placeholder="0" />
          </View>

          <Text style={styles.fieldLabel}>PAID USING *</Text>
          <View style={styles.methodRow}>
            {primaryMethods.map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[styles.methodChip, expense.paymentMethod === method.value && styles.methodChipOn]}
                onPress={() => expense.setPaymentMethod(method.value)}
              >
                <Text style={[styles.methodText, expense.paymentMethod === method.value && styles.methodTextOn]}>{method.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.methodChip, additionalMethods.some((method) => method.value === expense.paymentMethod) && styles.methodChipOn]}
              onPress={() => setShowMoreMethods((visible) => !visible)}
            >
              <Text style={[styles.methodText, additionalMethods.some((method) => method.value === expense.paymentMethod) && styles.methodTextOn]}>
                {additionalMethods.find((method) => method.value === expense.paymentMethod)?.label ?? 'More'} {showMoreMethods ? '⌃' : '⌄'}
              </Text>
            </TouchableOpacity>
          </View>
          {showMoreMethods ? (
            <View style={styles.moreMethodRow}>
              {additionalMethods.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[styles.methodChip, expense.paymentMethod === method.value && styles.methodChipOn]}
                  onPress={() => {
                    expense.setPaymentMethod(method.value);
                    setShowMoreMethods(false);
                  }}
                >
                  <Text style={[styles.methodText, expense.paymentMethod === method.value && styles.methodTextOn]}>{method.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>PAID TO</Text>
          <TextInput style={styles.input} value={expense.payee} onChangeText={expense.setPayee} placeholder="Optional person or business" autoCapitalize="words" />
          <Text style={styles.fieldLabel}>NOTE</Text>
          <TextInput style={[styles.input, styles.notesInput]} value={expense.notes} onChangeText={expense.setNotes} placeholder="Optional internal note" multiline />
          <Text style={styles.fieldLabel}>REFERENCE NUMBER (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={expense.reference}
            onChangeText={expense.setReference}
            placeholder={referencePlaceholders[expense.paymentMethod]}
            autoCapitalize="characters"
          />

          <TouchableOpacity style={[styles.submitButton, expense.submitting && styles.disabled]} onPress={expense.record} disabled={expense.submitting}>
            {expense.submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Record expense</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.listSection}>
          <View style={styles.listHeading}>
            <View><Text style={styles.listTitle}>Expense history</Text><Text style={styles.listSubtitle}>Voided entries remain visible for audit</Text></View>
            <View style={styles.countBadge}><Text style={styles.countText}>{visibleExpenses.length}</Text></View>
          </View>
          <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Search category, payee or reference" placeholderTextColor="#94A3B8" />
          <View style={styles.filterRow}>
            {(['active', 'all', 'voided'] as ExpenseStatusFilter[]).map((value) => (
              <TouchableOpacity key={value} style={[styles.filterChip, status === value && styles.filterChipOn]} onPress={() => setStatus(value)}>
                <Text style={[styles.filterText, status === value && styles.filterTextOn]}>{value === 'active' ? 'Active' : value === 'voided' ? 'Voided' : 'All'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {expense.loading ? <ActivityIndicator color="#C2410C" style={styles.loader} /> : visibleExpenses.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyTitle}>No matching expenses</Text><Text style={styles.emptyText}>Record an expense above or choose another filter.</Text></View>
          ) : visibleExpenses.map((row) => {
            const voided = Boolean(row.voided_at);
            return (
              <View key={row.id} style={[styles.expenseRow, voided && styles.voidedRow]}>
                <View style={[styles.categoryIcon, voided && styles.voidedIcon]}><Text style={styles.categoryInitial}>{row.category?.name?.slice(0, 1).toUpperCase() || '?'}</Text></View>
                <View style={styles.expenseCopy}>
                  <Text style={[styles.categoryName, voided && styles.voidedText]}>{row.category?.name || 'Unknown category'}</Text>
                  <Text style={styles.expenseMeta}>{[row.payee, row.payment_method.replace('_', ' ').toUpperCase(), row.reference_number].filter(Boolean).join(' · ')}</Text>
                  {row.notes ? <Text style={styles.expenseNote} numberOfLines={1}>{row.notes}</Text> : null}
                  {voided ? <Text style={styles.voidReason}>Voided · {row.void_reason}</Text> : null}
                </View>
                <View style={styles.amountCopy}>
                  <Text style={[styles.rowAmount, voided && styles.voidedText]}>{formatMoney(row.amount, 2)}</Text>
                  {!voided ? <TouchableOpacity onPress={() => setVoidTarget(row)}><Text style={styles.voidAction}>Void</Text></TouchableOpacity> : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <ExpenseCategoryModal visible={showCategoryModal} saving={expense.submitting} onClose={() => setShowCategoryModal(false)} onSave={expense.createCategory} />
      <SearchableSelectModal
        visible={showCategorySelector}
        title="Select expense category"
        searchPlaceholder="Search categories"
        options={categoryOptions}
        emptyMessage="No active expense category found"
        onSelect={expense.setCategoryId}
        onClose={() => setShowCategorySelector(false)}
      />
      <ExpenseVoidModal
        expense={voidTarget}
        saving={expense.submitting}
        onClose={() => setVoidTarget(null)}
        onConfirm={async (reason) => {
          if (voidTarget && await expense.voidEntry(voidTarget.id, reason)) setVoidTarget(null);
        }}
      />
    </View>
  );
}
