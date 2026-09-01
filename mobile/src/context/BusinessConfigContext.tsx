import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getBusinessPreferences,
  getBusinessProfile,
  updateBusinessConfiguration,
  type BusinessConfigurationUpdate,
} from '../api/businessConfiguration';
import { DEFAULT_BUSINESS_CONFIGURATION } from '../config/businessDefaults';
import type { BusinessConfiguration } from '../types';
import { useAuth } from './AuthContext';
import { formatConfiguredMoney } from '../utils/businessFormatting';

type BusinessConfigContextValue = {
  configuration: BusinessConfiguration;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (input: BusinessConfigurationUpdate) => Promise<void>;
  formatMoney: (amount: number, fractionDigits?: number) => string;
};

const BusinessConfigContext = createContext<BusinessConfigContextValue | null>(null);

export function BusinessConfigProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const authenticatedUserId = session?.user.id ?? null;
  const [configuration, setConfiguration] = useState(DEFAULT_BUSINESS_CONFIGURATION);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getBusinessProfile();
      if (!authenticatedUserId) {
        setConfiguration((current) => ({ ...current, profile }));
        return;
      }

      const preferences = await getBusinessPreferences();
      setConfiguration({ profile, preferences });
    } catch (error) {
      // Defaults keep the login and app usable during first-time database setup.
      console.warn('Unable to load business configuration; using safe defaults.', error);
    } finally {
      setLoading(false);
    }
  }, [authenticatedUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (input: BusinessConfigurationUpdate) => {
    const updated = await updateBusinessConfiguration(input);
    setConfiguration(updated);
  }, []);

  const formatMoney = useCallback((amount: number, fractionDigits = 2) => {
    return formatConfiguredMoney(amount, configuration.preferences, fractionDigits);
  }, [configuration.preferences]);

  const value = useMemo<BusinessConfigContextValue>(() => ({
    configuration,
    loading,
    refresh,
    save,
    formatMoney,
  }), [configuration, formatMoney, loading, refresh, save]);

  return (
    <BusinessConfigContext.Provider value={value}>
      {children}
    </BusinessConfigContext.Provider>
  );
}

export function useBusinessConfig(): BusinessConfigContextValue {
  const context = useContext(BusinessConfigContext);
  if (!context) {
    throw new Error('useBusinessConfig must be used within BusinessConfigProvider');
  }
  return context;
}
