import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useBusinessConfig } from '../context/BusinessConfigContext';
import type { BusinessModules, BusinessTerminology } from '../types';
import styles from '../styles/BusinessSettingsScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'BusinessSettings'>;

type Draft = {
  displayName: string;
  legalName: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  primaryColor: string;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  timezone: string;
  defaultCrateWeightKg: string;
  purchaseWeightDeductionPercent: string;
  mediatorCommissionPerKg: string;
  directCommissionPerKg: string;
};

const terminologyFields: Array<{ key: keyof BusinessTerminology; label: string }> = [
  { key: 'item', label: 'Item' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'mediator', label: 'Mediator' },
  { key: 'farmer', label: 'Farmer' },
  { key: 'customer', label: 'Customer' },
  { key: 'crate', label: 'Crate' },
  { key: 'weight', label: 'Weight unit' },
];

const moduleFields: Array<{ key: keyof BusinessModules; label: string }> = [
  { key: 'purchases', label: 'Purchases' },
  { key: 'sales', label: 'Sales' },
  { key: 'packing', label: 'Packing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'customer_billing', label: 'Customer billing' },
  { key: 'supplier_billing', label: 'Supplier billing' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'cashbook', label: 'Cashbook & day closing' },
  { key: 'profitability', label: 'Profitability' },
];

export default function BusinessSettingsScreen({ navigation }: Props) {
  const { configuration, save } = useBusinessConfig();
  const { profile, preferences } = configuration;
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({} as Draft);
  const [terminology, setTerminology] = useState(preferences.terminology);
  const [enabledModules, setEnabledModules] = useState(preferences.enabled_modules);
  const [applyMediatorCommission, setApplyMediatorCommission] = useState(true);
  const [applyDirectCommission, setApplyDirectCommission] = useState(false);

  useEffect(() => {
    setDraft({
      displayName: profile.display_name,
      legalName: profile.legal_name ?? '',
      tagline: profile.tagline,
      description: profile.description ?? '',
      phone: profile.phone ?? '',
      email: profile.email ?? '',
      address: profile.address ?? '',
      logoUrl: profile.logo_url ?? '',
      primaryColor: profile.primary_color,
      currencyCode: preferences.currency_code,
      currencySymbol: preferences.currency_symbol,
      locale: preferences.locale,
      timezone: preferences.timezone,
      defaultCrateWeightKg: String(preferences.default_crate_weight_kg),
      purchaseWeightDeductionPercent: String(preferences.purchase_weight_deduction_percent),
      mediatorCommissionPerKg: String(preferences.mediator_commission_per_kg),
      directCommissionPerKg: String(preferences.direct_commission_per_kg),
    });
    setTerminology(preferences.terminology);
    setEnabledModules(preferences.enabled_modules);
    setApplyMediatorCommission(preferences.apply_mediator_commission_by_default);
    setApplyDirectCommission(preferences.apply_direct_commission_by_default);
  }, [preferences, profile]);

  const setValue = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    const crateWeight = Number(draft.defaultCrateWeightKg);
    const deduction = Number(draft.purchaseWeightDeductionPercent);
    const mediatorCommission = Number(draft.mediatorCommissionPerKg);
    const directCommission = Number(draft.directCommissionPerKg);

    if (!draft.displayName.trim() || !draft.tagline.trim()) {
      Alert.alert('Check business details', 'Display name and tagline are required.');
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(draft.primaryColor.trim())) {
      Alert.alert('Check brand colour', 'Enter a six-digit hex colour such as #0EA5E9.');
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(draft.currencyCode.trim()) || !draft.currencySymbol.trim()) {
      Alert.alert('Check currency', 'Currency code must contain three letters, such as INR.');
      return;
    }
    if (!draft.locale.trim() || !draft.timezone.trim()) {
      Alert.alert('Check regional settings', 'Number locale and timezone are required.');
      return;
    }
    if (!Number.isFinite(crateWeight) || crateWeight <= 0) {
      Alert.alert('Check crate weight', 'Default crate weight must be greater than zero.');
      return;
    }
    if (!Number.isFinite(deduction) || deduction < 0 || deduction > 100) {
      Alert.alert('Check deduction', 'Purchase deduction must be between 0 and 100%.');
      return;
    }
    if (mediatorCommission < 0 || directCommission < 0) {
      Alert.alert('Check commission', 'Commission values cannot be negative.');
      return;
    }
    if (Object.values(terminology).some((value) => !value.trim())) {
      Alert.alert('Check terminology', 'Terminology labels cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await save({
        profile: {
          display_name: draft.displayName.trim(),
          legal_name: draft.legalName.trim() || null,
          tagline: draft.tagline.trim(),
          description: draft.description.trim() || null,
          phone: draft.phone.trim() || null,
          email: draft.email.trim() || null,
          address: draft.address.trim() || null,
          logo_url: draft.logoUrl.trim() || null,
          primary_color: draft.primaryColor.trim().toUpperCase(),
        },
        preferences: {
          currency_code: draft.currencyCode.trim().toUpperCase(),
          currency_symbol: draft.currencySymbol.trim(),
          locale: draft.locale.trim(),
          timezone: draft.timezone.trim(),
          default_crate_weight_kg: crateWeight,
          purchase_weight_deduction_percent: deduction,
          mediator_commission_per_kg: mediatorCommission,
          direct_commission_per_kg: directCommission,
          apply_mediator_commission_by_default: applyMediatorCommission,
          apply_direct_commission_by_default: applyDirectCommission,
          terminology,
          enabled_modules: enabledModules,
        },
        expectedUpdatedAt: preferences.updated_at,
      });
      Alert.alert('Settings saved', 'New defaults will be used for future entries and bills.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Unable to save settings', message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (
    label: string,
    key: keyof Draft,
    options?: { keyboardType?: 'default' | 'decimal-pad' | 'email-address'; multiline?: boolean },
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, options?.multiline && styles.multilineInput]}
        value={draft[key] ?? ''}
        onChangeText={(value) => setValue(key, value)}
        keyboardType={options?.keyboardType ?? 'default'}
        multiline={options?.multiline}
        autoCapitalize={options?.keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: profile.primary_color }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ADMINISTRATION</Text>
          <Text style={styles.title}>Business settings</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            These values configure this trader deployment. Existing bills and audit records are unchanged.
          </Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Business identity</Text>
            {renderField('Display name *', 'displayName')}
            {renderField('Legal name', 'legalName')}
            {renderField('Tagline *', 'tagline')}
            {renderField('Description', 'description', { multiline: true })}
            {renderField('Phone', 'phone')}
            {renderField('Email', 'email', { keyboardType: 'email-address' })}
            {renderField('Address', 'address', { multiline: true })}
            {renderField('Logo URL', 'logoUrl')}
            {renderField('Primary colour', 'primaryColor')}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Regional settings</Text>
            <View style={styles.twoColumns}>
              <View style={styles.column}>{renderField('Currency code', 'currencyCode')}</View>
              <View style={styles.column}>{renderField('Symbol', 'currencySymbol')}</View>
            </View>
            {renderField('Number locale', 'locale')}
            {renderField('Timezone', 'timezone')}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Trading defaults</Text>
            {renderField('Default kg per crate', 'defaultCrateWeightKg', { keyboardType: 'decimal-pad' })}
            {renderField('Purchase weight deduction %', 'purchaseWeightDeductionPercent', { keyboardType: 'decimal-pad' })}
            {renderField('Mediator commission per kg', 'mediatorCommissionPerKg', { keyboardType: 'decimal-pad' })}
            <ToggleRow
              label="Apply mediator commission by default"
              value={applyMediatorCommission}
              onChange={setApplyMediatorCommission}
            />
            {renderField('Direct commission per kg', 'directCommissionPerKg', { keyboardType: 'decimal-pad' })}
            <ToggleRow
              label="Apply direct commission by default"
              value={applyDirectCommission}
              onChange={setApplyDirectCommission}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Terminology</Text>
            <Text style={styles.help}>Change labels without changing the underlying business logic.</Text>
            {terminologyFields.map(({ key, label }) => (
              <View style={styles.field} key={key}>
                <Text style={styles.label}>{label} label</Text>
                <TextInput
                  style={styles.input}
                  value={terminology[key]}
                  onChangeText={(value) => setTerminology((current) => ({ ...current, [key]: value }))}
                />
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Enabled modules</Text>
            <Text style={styles.help}>Disabled modules are hidden from the main workspace.</Text>
            {moduleFields.map(({ key, label }) => (
              <ToggleRow
                key={key}
                label={label}
                value={enabledModules[key]}
                onChange={(value) => setEnabledModules((current) => ({ ...current, [key]: value }))}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save settings</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#5EEAD4' }} />
    </View>
  );
}
