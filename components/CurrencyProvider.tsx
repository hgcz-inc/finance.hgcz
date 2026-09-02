'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Currency, normalizeCurrency } from '@/lib/currency';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export default function CurrencyProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [currency, setCurrency] = useState<Currency>('VND');

  useEffect(() => {
    const loadCurrency = async () => {
      const response = await fetch('/api/session');
      if (!response.ok) return;

      const data = await response.json();
      setCurrency(normalizeCurrency(data.user?.currency));
    };

    loadCurrency();
  }, []);

  const value = useMemo(() => ({ currency, setCurrency }), [currency]);

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
