'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/components/CurrencyProvider';
import { Currency, formatMoney, normalizeCurrency } from '@/lib/currency';

export default function ConfigurationPage() {
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currency);
  const [maxSpendingLimit, setMaxSpendingLimit] = useState('0');
  const [showMaxSpendingLimit, setShowMaxSpendingLimit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/application-config');
      const data = await response.json();

      if (data.success) {
        setSelectedCurrency(normalizeCurrency(data.config?.currency));
        setMaxSpendingLimit(
          String(data.config?.maxSpendingLimitPerYearVnd ?? 0)
        );
        setShowMaxSpendingLimit(
          data.config?.showMaxSpendingLimitPerYear === true
        );
      } else {
        setErrorMessage(data.error || 'Có lỗi xảy ra khi tải config.');
      }
    } catch (error) {
      console.error('Error fetching application config:', error);
      setErrorMessage('Có lỗi xảy ra khi tải config.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
      return;
    }

    fetchConfig();
  }, [router, fetchConfig]);

  const handleSave = async () => {
    const value = Number(maxSpendingLimit);
    if (!Number.isFinite(value) || value < 0) {
      setSuccessMessage(null);
      setErrorMessage('Vui lòng nhập giá trị lớn hơn hoặc bằng 0.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/application-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxSpendingLimitPerYearVnd: value,
          showMaxSpendingLimitPerYear: showMaxSpendingLimit,
          currency: selectedCurrency,
        }),
      });
      const data = await response.json();

      if (data.success) {
        const savedValue = data.config?.maxSpendingLimitPerYearVnd ?? value;
        setMaxSpendingLimit(String(savedValue));
        setShowMaxSpendingLimit(
          data.config?.showMaxSpendingLimitPerYear === true
        );
        const savedCurrency: Currency = normalizeCurrency(data.config?.currency);
        setSelectedCurrency(savedCurrency);
        setCurrency(savedCurrency);
        setSuccessMessage('Đã lưu config.');
      } else {
        setErrorMessage(data.error || 'Có lỗi xảy ra khi lưu config.');
      }
    } catch (error) {
      console.error('Error saving application config:', error);
      setErrorMessage('Có lỗi xảy ra khi lưu config.');
    } finally {
      setSaving(false);
    }
  };

  const previewValue = Number(maxSpendingLimit);
  const monthlyLimit =
    Number.isFinite(previewValue) && previewValue >= 0 ? previewValue / 12 : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Configuration
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Spending limits
            </p>
          </div>
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Dashboard
          </Link>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800">
          <label className="mb-6 block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Currency
            </span>
            <select
              value={selectedCurrency}
              onChange={(event) =>
                setSelectedCurrency(event.target.value as Currency)
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="VND">VND</option>
              <option value="NZD">NZD</option>
            </select>
          </label>

          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Spending limits
          </h2>

          <label className="mb-4 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={showMaxSpendingLimit}
              onChange={(event) => setShowMaxSpendingLimit(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show Max Spending Limit per Year
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Max Spending Limit per Year ({selectedCurrency})
            </span>
            <input
              type="number"
              min="0"
              step="1000"
              value={maxSpendingLimit}
              onChange={(event) => setMaxSpendingLimit(event.target.value)}
              disabled={!showMaxSpendingLimit}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="0"
            />
          </label>

          {showMaxSpendingLimit && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              Monthly limit preview:{' '}
              <strong>{formatMoney(monthlyLimit, selectedCurrency)}</strong>
            </div>
          )}

          {successMessage && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">
              {successMessage}
            </p>
          )}
          {errorMessage && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
