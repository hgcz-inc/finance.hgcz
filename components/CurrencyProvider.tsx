'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CURRENCY_STORAGE_KEY,
  Currency,
  normalizeCurrency,
} from '@/lib/currency';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readStoredCurrency(): Currency | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
  if (storedCurrency) {
    return normalizeCurrency(storedCurrency);
  }

  const storedUser = window.localStorage.getItem('user');
  if (!storedUser) {
    return null;
  }

  try {
    return normalizeCurrency(JSON.parse(storedUser)?.currency);
  } catch {
    return null;
  }
}

function writeStoredCurrency(currency: Currency): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);

  const storedUser = window.localStorage.getItem('user');
  if (!storedUser) {
    return;
  }

  try {
    const user = JSON.parse(storedUser);
    window.localStorage.setItem(
      'user',
      JSON.stringify({ ...user, currency })
    );
  } catch {
    // Keep the auth marker intact; the session API remains the source of truth.
  }
}

export default function CurrencyProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [currency, setCurrencyState] = useState<Currency>(
    () => readStoredCurrency() ?? 'VND'
  );
  const setCurrency = useCallback((value: Currency) => {
    const nextCurrency = normalizeCurrency(value);
    setCurrencyState(nextCurrency);
    writeStoredCurrency(nextCurrency);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurrency = async () => {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json();
      if (isMounted) {
        setCurrency(normalizeCurrency(data.user?.currency));
      }
    };

    loadCurrency();

    return () => {
      isMounted = false;
    };
  }, [setCurrency]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CURRENCY_STORAGE_KEY && event.key !== 'user') {
        return;
      }

      const storedCurrency = readStoredCurrency();
      if (storedCurrency) {
        setCurrencyState(storedCurrency);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(
    () => ({ currency, setCurrency }),
    [currency, setCurrency]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used inside CurrencyProvider');
  }
  return context;
}
