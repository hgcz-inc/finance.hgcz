'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useCurrency } from '@/components/CurrencyProvider';
import { formatCompactMoney, formatMoney } from '@/lib/currency';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
);

interface Summary {
  inflow: number;
  outflow: number;
  netBalance: number;
}

interface SpendingLimitInfo {
  maxSpendingLimitPerYearVnd: number;
  showMaxSpendingLimitPerYear: boolean;
  yearToDateOutflow: number;
  remainingYearSpending: number;
}

interface CategoryItem {
  category_name: string;
  category_id: number;
  total: number;
}

interface TransactionRow {
  id: number;
  amount: number | null;
  kind: number;
  note: string | null;
  transaction_date: string | null;
  category_name: string | null;
}

interface CategoryOption {
  id: number;
  name: string;
}

type CurrencyOption = 'VND' | 'NZD';
type TransactionAccountOption = 'Individual' | 'Joint';
type ImportAccountOption = 'joint' | 'individual';

const DEFAULT_EXCHANGE_RATE = '15.000';
const CSV_IMPORT_FORMAT =
  'Type,Details,Particulars,Code,Reference,Amount,Date,ForeignCurrencyAmount,ConversionCharge,Categorizable';

const expenseCategoryNames: Record<number, string> = {
  1: 'Food & Beverage',
  2: 'Bills & Utilities',
  3: 'Transportation',
  4: 'Education',
  5: 'Investment',
  6: 'Shopping',
  7: 'Entertainment',
  8: 'Health & Fitness',
  9: 'Gifts & Donations',
  10: 'Other Expense',
  11: 'Home Rent',
};

const incomeCategoryNames: Record<number, string> = {
  1: 'Salary',
  2: 'Interest Money',
  3: 'Stock',
  4: 'Real Estate',
  5: 'Cryptocurrency',
  6: 'Gifts',
  7: 'Selling',
  8: 'Other Income',
  9: 'Side Project',
};

function parsePositiveNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseExchangeRate(value: string): number {
  const normalized = value.trim().replace(/\s/g, '');
  const withoutGroupSeparators = normalized.replace(
    /[.,](?=\d{3}(?:\D|$))/g,
    ''
  );
  const parsed = Number(withoutGroupSeparators.replace(',', '.'));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatCalculatedAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function adjustAmountForAccountChange(
  amountText: string,
  nextAccount: TransactionAccountOption,
  previousAccount: TransactionAccountOption
): string {
  const amount = Number(amountText);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    nextAccount === previousAccount
  ) {
    return amountText;
  }

  if (nextAccount === 'Joint' && previousAccount === 'Individual') {
    return formatCalculatedAmount(amount / 2);
  }

  if (nextAccount === 'Individual' && previousAccount === 'Joint') {
    return formatCalculatedAmount(amount * 2);
  }

  return amountText;
}

function stripOutflowNoteHelpers(note: string): string {
  return note
    .replace(/^(Individual|Joint)\s*\|\s*/i, '')
    .replace(/\s*(?:\|\s*)?[\d.,]+\s*NZD\s*$/i, '')
    .trim();
}

function buildOutflowNote(
  baseNote: string,
  transactionAccount: TransactionAccountOption,
  currency: CurrencyOption,
  nzdAmount: string
): string {
  const base = stripOutflowNoteHelpers(baseNote);
  const parsedNzdAmount = parsePositiveNumber(nzdAmount);
  const nzdSuffix =
    currency === 'NZD' && parsedNzdAmount > 0 ? `${nzdAmount.trim()} NZD` : '';

  if (base && nzdSuffix) {
    return `${transactionAccount} | ${base} | ${nzdSuffix}`;
  }

  if (base) {
    return `${transactionAccount} | ${base}`;
  }

  if (nzdSuffix) {
    return `${transactionAccount} | ${nzdSuffix}`;
  }

  return `${transactionAccount} | `;
}

function calculateNzdToVndAmount(
  nzdAmount: string,
  exchangeRate: string,
  transactionAccount: TransactionAccountOption
): string {
  const parsedNzdAmount = parsePositiveNumber(nzdAmount);
  const parsedExchangeRate = parseExchangeRate(exchangeRate);

  if (parsedNzdAmount === 0 || parsedExchangeRate === 0) {
    return '';
  }

  const convertedAmount = parsedNzdAmount * parsedExchangeRate;
  const adjustedAmount =
    transactionAccount === 'Joint' ? convertedAmount / 2 : convertedAmount;

  return formatCalculatedAmount(adjustedAmount);
}

function segmentedButtonClass(isActive: boolean): string {
  const base =
    'flex-1 px-3 py-2 text-sm font-medium transition-colors border first:rounded-l-lg last:rounded-r-lg';

  return isActive
    ? `${base} bg-blue-600 border-blue-600 text-white`
    : `${base} bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600`;
}

function importAccountLabel(account: ImportAccountOption): string {
  return account === 'joint'
    ? 'Outcome | ANZ | Joint account | CSV'
    : 'Outcome | ANZ | Individual account | CSV';
}

export default function CashflowTransactionsPage() {
  const router = useRouter();
  const { currency } = useCurrency();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [spendingLimit, setSpendingLimit] =
    useState<SpendingLimitInfo | null>(null);
  const [outflowByCategory, setOutflowByCategory] = useState<CategoryItem[]>([]);
  const [inflowByCategory, setInflowByCategory] = useState<CategoryItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [incomeCategories, setIncomeCategories] = useState<CategoryOption[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryOption[]>([]);
  const [modalOpen, setModalOpen] = useState<'inflow' | 'outflow' | null>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] =
    useState<ImportAccountOption | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importExchangeRate, setImportExchangeRate] =
    useState(DEFAULT_EXCHANGE_RATE);
  const [importDragging, setImportDragging] = useState(false);
  const [formAmount, setFormAmount] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number | ''>('');
  const toLocalDateInputValue = (d: Date) => {
    // Use local timezone to avoid `toISOString()` (UTC) shifting the date.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [formDate, setFormDate] = useState(() => toLocalDateInputValue(new Date()));
  const [formNote, setFormNote] = useState('');
  const [formCurrency, setFormCurrency] = useState<CurrencyOption>('NZD');
  const [formExchangeRate, setFormExchangeRate] = useState(DEFAULT_EXCHANGE_RATE);
  const [formNzdAmount, setFormNzdAmount] = useState('');
  const [formTransactionAccount, setFormTransactionAccount] =
    useState<TransactionAccountOption>('Individual');
  const [saving, setSaving] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<
    string | null
  >(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(
    null
  );

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/cashflow-categories');
      const data = await res.json();
      if (data.success) {
        setIncomeCategories(data.incomeCategories ?? []);
        setExpenseCategories(data.expenseCategories ?? []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cashflow-transactions?year=${y}&month=${m}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setSpendingLimit(data.spendingLimit ?? null);
        setOutflowByCategory(data.outflowByCategory ?? []);
        setInflowByCategory(data.inflowByCategory ?? []);
        setTransactions(data.transactions ?? []);
      }
    } catch (e) {
      console.error(e);
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
    fetchCategories();
    fetchData(year, month);
  }, [router, year, month, fetchData, fetchCategories]);

  const openInflowModal = () => {
    setFormAmount('');
    const defaultId = incomeCategories[0]?.id;
    setFormCategoryId(defaultId != null ? Number(defaultId) : '');
    setFormDate(toLocalDateInputValue(new Date()));
    setFormNote('');
    setFormCurrency('NZD');
    setFormExchangeRate(DEFAULT_EXCHANGE_RATE);
    setFormNzdAmount('');
    setFormTransactionAccount('Individual');
    setSuccessMessage(null);
    setErrorMessage(null);
    setModalOpen('inflow');
  };

  const openOutflowModal = () => {
    setFormAmount('');
    const defaultId = expenseCategories[0]?.id;
    setFormCategoryId(defaultId != null ? Number(defaultId) : '');
    setFormDate(toLocalDateInputValue(new Date()));
    setFormCurrency('NZD');
    setFormExchangeRate(DEFAULT_EXCHANGE_RATE);
    setFormNzdAmount('');
    setFormTransactionAccount('Individual');
    setFormNote(buildOutflowNote('', 'Individual', 'NZD', ''));
    setSuccessMessage(null);
    setErrorMessage(null);
    setModalOpen('outflow');
  };

  const closeModal = () => {
    setModalOpen(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const openImportModal = (account: ImportAccountOption) => {
    setImportMenuOpen(false);
    setImportModalOpen(account);
    setImportFile(null);
    setImportExchangeRate(DEFAULT_EXCHANGE_RATE);
    setImportDragging(false);
    setImportSuccessMessage(null);
    setImportErrorMessage(null);
  };

  const closeImportModal = () => {
    if (importSaving) {
      return;
    }

    setImportModalOpen(null);
    setImportFile(null);
    setImportExchangeRate(DEFAULT_EXCHANGE_RATE);
    setImportDragging(false);
    setImportSuccessMessage(null);
    setImportErrorMessage(null);
  };

  const handleImportFile = (file: File | null) => {
    setImportSuccessMessage(null);

    if (!file) {
      setImportFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportFile(null);
      setImportErrorMessage('Chỉ cho phép upload file CSV.');
      return;
    }

    setImportFile(file);
    setImportErrorMessage(null);
  };

  const handleImportCsv = async () => {
    if (!importModalOpen) {
      return;
    }

    if (!importFile) {
      setImportErrorMessage('Vui lòng chọn file CSV để import.');
      return;
    }

    setImportSaving(true);
    setImportSuccessMessage(null);
    setImportErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('account', importModalOpen);
      formData.append('exchangeRate', importExchangeRate);
      formData.append('file', importFile);

      const res = await fetch('/api/cashflow-transactions/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setImportSuccessMessage(
          `Đã import ${Number(data.insertedCount ?? 0)} transactions.`
        );
        setImportFile(null);
        await fetchData(year, month);
      } else {
        setImportErrorMessage(data.error || 'Có lỗi xảy ra khi import CSV.');
      }
    } catch (e) {
      console.error(e);
      setImportErrorMessage('Có lỗi xảy ra khi import CSV.');
    } finally {
      setImportSaving(false);
    }
  };

  const handleAmountChange = (value: string) => {
    setFormAmount(value);
  };

  const handleNoteChange = (value: string) => {
    if (modalOpen !== 'outflow') {
      setFormNote(value);
      return;
    }

    setFormNote(
      buildOutflowNote(
        value,
        formTransactionAccount,
        formCurrency,
        formNzdAmount
      )
    );
  };

  const handleCurrencyChange = (value: CurrencyOption) => {
    setFormCurrency(value);

    if (value === 'NZD') {
      setFormAmount(
        calculateNzdToVndAmount(
          formNzdAmount,
          formExchangeRate,
          formTransactionAccount
        )
      );
    }

    setFormNote((note) =>
      buildOutflowNote(note, formTransactionAccount, value, formNzdAmount)
    );
  };

  const handleExchangeRateChange = (value: string) => {
    setFormExchangeRate(value);
    setFormAmount(
      calculateNzdToVndAmount(
        formNzdAmount,
        value,
        formTransactionAccount
      )
    );
  };

  const handleNzdAmountChange = (value: string) => {
    setFormNzdAmount(value);
    setFormAmount(
      calculateNzdToVndAmount(
        value,
        formExchangeRate,
        formTransactionAccount
      )
    );
    setFormNote((note) =>
      buildOutflowNote(note, formTransactionAccount, formCurrency, value)
    );
  };

  const handleTransactionAccountChange = (
    value: TransactionAccountOption
  ) => {
    setFormTransactionAccount(value);

    if (currency === 'VND' && formCurrency === 'NZD') {
      setFormAmount(
        calculateNzdToVndAmount(formNzdAmount, formExchangeRate, value)
      );
    } else {
      setFormAmount(
        adjustAmountForAccountChange(formAmount, value, formTransactionAccount)
      );
    }

    setFormNote((note) =>
      buildOutflowNote(note, value, formCurrency, formNzdAmount)
    );
  };

  const handleSaveTransaction = async () => {
    const amount = Number(formAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Vui lòng nhập số tiền lớn hơn 0.');
      return;
    }
    const kind = modalOpen === 'inflow' ? 2 : 1;
    const categorizable_type =
      modalOpen === 'inflow' ? 'IncomeCategory' : 'ExpenseCategory';
    const categorizable_id = formCategoryId === '' ? null : Number(formCategoryId);
    if (categorizable_id == null || !Number.isFinite(categorizable_id)) {
      setErrorMessage('Vui lòng chọn category.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/cashflow-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          kind,
          categorizable_type,
          categorizable_id,
          transaction_date: formDate,
          note: formNote || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Lưu thành công.');
        setErrorMessage(null);
        setTimeout(() => {
          closeModal();
          fetchData(year, month);
        }, 800);
      } else {
        setSuccessMessage(null);
        setErrorMessage(data.error || 'Có lỗi xảy ra.');
      }
    } catch (e) {
      console.error(e);
      setSuccessMessage(null);
      setErrorMessage('Có lỗi xảy ra.');
    } finally {
      setSaving(false);
    }
  };

  const goPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const monthLabel = `${year}/${month}`;
  const showSpendingLimit =
    spendingLimit?.showMaxSpendingLimitPerYear === true;
  const annualOverspending = Math.max(
    -(spendingLimit?.remainingYearSpending ?? 0),
    0
  );

  const outflowChartData = useMemo(() => {
    const labels = outflowByCategory.map(
      (c) => expenseCategoryNames[c.category_id] || c.category_name || 'Unknown'
    );
    const values = outflowByCategory.map((c) => Math.abs(c.total));
    return {
      labels,
      datasets: [
        {
          label: 'Outflow',
          data: values,
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
        },
      ],
    };
  }, [outflowByCategory]);

  const inflowChartData = useMemo(() => {
    const labels = inflowByCategory.map(
      (c) => incomeCategoryNames[c.category_id] || c.category_name || 'Unknown'
    );
    const values = inflowByCategory.map((c) => Math.abs(c.total));
    return {
      labels,
      datasets: [
        {
          label: 'Inflow',
          data: values,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
      ],
    };
  }, [inflowByCategory]);

  const chartOptionsOutflow = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) => formatMoney(Number(ctx.raw ?? 0), currency),
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: (v: unknown) => formatCompactMoney(Number(v), currency),
          },
        },
        y: { grid: { display: false } },
      },
    }),
    [currency]
  );

  const chartOptionsInflow = useMemo(
    () => ({
      indexAxis: 'x' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) => formatMoney(Number(ctx.raw ?? 0), currency),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v: unknown) => formatCompactMoney(Number(v), currency),
          },
        },
        x: { grid: { display: false } },
      },
    }),
    [currency]
  );

  if (loading && !summary) {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Transactions
          </h1>
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Dashboard
          </Link>
        </div>

        {spendingLimit && showSpendingLimit && (
          <div className="mb-6 space-y-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <span className="font-semibold">
                Max Spending Limit per Year:
              </span>{' '}
              {formatMoney(spendingLimit.maxSpendingLimitPerYearVnd, currency)}
            </div>

            {annualOverspending > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
                Cảnh báo: Bạn đã chi tiêu vượt ngân sách năm{' '}
                <strong>{formatMoney(annualOverspending, currency)}</strong>.
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Spending còn lại của năm:{' '}
                <strong>
                  {formatMoney(spendingLimit.remainingYearSpending, currency)}
                </strong>.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Box 1: Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {monthLabel}
            </h2>
            <div className="space-y-2 mb-4">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Inflow: </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  {formatMoney(summary?.inflow, currency)}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Outflow: </span>
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {formatMoney(summary?.outflow, currency)}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">Net: </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatMoney(summary?.netBalance, currency)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goPrevMonth}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                aria-label="Previous month"
              >
                ←
              </button>
              <button
                type="button"
                onClick={goNextMonth}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                aria-label="Next month"
              >
                →
              </button>
            </div>
          </div>

          {/* Box 2: Outflow structure */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Outflow Structure
            </h2>
            <div className="h-[250px] sm:h-[280px]">
              {outflowByCategory.length > 0 ? (
                <Bar data={outflowChartData} options={chartOptionsOutflow} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                  No outflow for this month
                </div>
              )}
            </div>
          </div>

          {/* Box 3: Inflow structure */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Inflow Structure
            </h2>
            <div className="h-[250px] sm:h-[280px]">
              {inflowByCategory.length > 0 ? (
                <Bar data={inflowChartData} options={chartOptionsInflow} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                  No inflow for this month
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transactions table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Transactions
            </h2>
            <div className="flex gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setImportMenuOpen((open) => !open)}
                  className="h-10 rounded-lg bg-gray-700 px-3 text-sm font-medium text-white shadow hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500"
                  aria-expanded={importMenuOpen}
                  aria-haspopup="menu"
                >
                  Import
                </button>
                {importMenuOpen && (
                  <div
                    className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                    role="menu"
                  >
                    <button
                      type="button"
                      onClick={() => openImportModal('joint')}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      role="menuitem"
                    >
                      Outcome | ANZ | Joint account | CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => openImportModal('individual')}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      role="menuitem"
                    >
                      Outcome | ANZ | Individual account | CSV
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={openOutflowModal}
                className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-xl font-medium shadow"
                aria-label="Tiền ra"
              >
                −
              </button>
              <button
                type="button"
                onClick={openInflowModal}
                className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center text-xl font-medium shadow"
                aria-label="Tiền vào"
              >
                +
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">
                    Date
                  </th>
                  <th className="py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">
                    Category
                  </th>
                  <th className="py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">
                    Amount
                  </th>
                  <th className="py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No transactions for this month
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-gray-100 dark:border-gray-700"
                    >
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {t.transaction_date ?? '-'}
                      </td>
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {t.category_name ?? '-'}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={
                            t.kind === 2
                              ? 'text-blue-600 dark:text-blue-400 font-medium'
                              : 'text-red-600 dark:text-red-400 font-medium'
                          }
                        >
                          {t.amount != null
                            ? formatMoney(t.amount, currency)
                            : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-600 dark:text-gray-400">
                        {t.note ?? '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Inflow / Outflow */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <div
              className="max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {modalOpen === 'inflow' ? 'Tiền vào' : 'Tiền ra'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) =>
                      setFormCategoryId(
                        e.target.value === ''
                          ? ''
                          : parseInt(e.target.value, 10)
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">-- Chọn category --</option>
                    {(modalOpen === 'inflow'
                      ? incomeCategories
                      : expenseCategories
                    ).map((c) => (
                      <option key={c.id} value={Number(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Note
                  </label>
                  <input
                    type="text"
                    value={formNote}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Ghi chú"
                  />
                </div>
                {modalOpen === 'outflow' && (
                  <>
                    {currency === 'VND' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Input Currency
                          </label>
                          <div
                            className="flex"
                            role="group"
                            aria-label="Input Currency"
                          >
                            <button
                              type="button"
                              onClick={() => handleCurrencyChange('NZD')}
                              className={segmentedButtonClass(formCurrency === 'NZD')}
                              aria-pressed={formCurrency === 'NZD'}
                            >
                              NZD
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCurrencyChange('VND')}
                              className={segmentedButtonClass(formCurrency === 'VND')}
                              aria-pressed={formCurrency === 'VND'}
                            >
                              VND
                            </button>
                          </div>
                        </div>
                        {formCurrency === 'NZD' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Exchange Rate
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={formExchangeRate}
                                onChange={(e) =>
                                  handleExchangeRateChange(e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="15.000"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Amount for NZD
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formNzdAmount}
                                onChange={(e) =>
                                  handleNzdAmountChange(e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="0"
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Transaction Account
                      </label>
                      <div
                        className="flex"
                        role="group"
                        aria-label="Transaction Account"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleTransactionAccountChange('Individual')
                          }
                          className={segmentedButtonClass(
                            formTransactionAccount === 'Individual'
                          )}
                          aria-pressed={formTransactionAccount === 'Individual'}
                        >
                          Individual
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleTransactionAccountChange('Joint')
                          }
                          className={segmentedButtonClass(
                            formTransactionAccount === 'Joint'
                          )}
                          aria-pressed={formTransactionAccount === 'Joint'}
                        >
                          Joint
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
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
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveTransaction}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
                >
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: CSV Import */}
        {importModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) =>
              e.target === e.currentTarget && closeImportModal()
            }
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Import CSV
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {importAccountLabel(importModalOpen)}
              </p>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                Warning: đảm bảo CSV có format{' '}
                <code className="font-mono break-all">{CSV_IMPORT_FORMAT}</code>
              </div>

              {currency === 'VND' && <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Exchange Rate
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={importExchangeRate}
                  onChange={(e) => setImportExchangeRate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="15.000"
                />
              </div>}

              <label
                className={
                  importDragging
                    ? 'mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-50 px-4 py-8 text-center dark:bg-blue-900/20'
                    : 'mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-center hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:hover:bg-blue-900/20'
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  setImportDragging(true);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget === e.target) {
                    setImportDragging(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setImportDragging(false);
                  handleImportFile(e.dataTransfer.files.item(0));
                }}
              >
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) =>
                    handleImportFile(e.target.files?.item(0) ?? null)
                  }
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Kéo thả file CSV vào đây
                </span>
                <span className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  hoặc click để chọn file
                </span>
                {importFile && (
                  <span className="mt-3 rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {importFile.name}
                  </span>
                )}
              </label>

              {importSuccessMessage && (
                <p className="mt-3 text-sm text-green-600 dark:text-green-400">
                  {importSuccessMessage}
                </p>
              )}
              {importErrorMessage && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-red-600 dark:text-red-400">
                  {importErrorMessage}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeImportModal}
                  disabled={importSaving}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={importSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {importSaving ? 'Đang import...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
