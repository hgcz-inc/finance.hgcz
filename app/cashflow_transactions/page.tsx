'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

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

function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' ₫';
}

function formatTriệu(value: number): string {
  const millions = value / 1_000_000;
  return `${millions.toFixed(0)} triệu đ`;
}

export default function CashflowTransactionsPage() {
  const router = useRouter();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [outflowByCategory, setOutflowByCategory] = useState<CategoryItem[]>([]);
  const [inflowByCategory, setInflowByCategory] = useState<CategoryItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [incomeCategories, setIncomeCategories] = useState<CategoryOption[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryOption[]>([]);
  const [modalOpen, setModalOpen] = useState<'inflow' | 'outflow' | null>(null);
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
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setSuccessMessage(null);
    setErrorMessage(null);
    setModalOpen('inflow');
  };

  const openOutflowModal = () => {
    setFormAmount('');
    const defaultId = expenseCategories[0]?.id;
    setFormCategoryId(defaultId != null ? Number(defaultId) : '');
    setFormDate(toLocalDateInputValue(new Date()));
    setFormNote('');
    setSuccessMessage(null);
    setErrorMessage(null);
    setModalOpen('outflow');
  };

  const closeModal = () => {
    setModalOpen(null);
    setSuccessMessage(null);
    setErrorMessage(null);
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
            label: (ctx: any) => formatVND(Number(ctx.raw ?? 0)),
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: (v: unknown) => formatTriệu(Number(v)),
          },
        },
        y: { grid: { display: false } },
      },
    }),
    []
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
            label: (ctx: any) => formatVND(Number(ctx.raw ?? 0)),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v: unknown) => formatTriệu(Number(v)),
          },
        },
        x: { grid: { display: false } },
      },
    }),
    []
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
          <a
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Dashboard
          </a>
        </div>

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
                  {summary ? formatVND(summary.inflow) : '0 ₫'}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Outflow: </span>
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {summary ? formatVND(summary.outflow) : '0 ₫'}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">Net: </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {summary ? formatVND(summary.netBalance) : '0 ₫'}
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
                        {t.transaction_date ? t.transaction_date.slice(0, 10) : '-'}
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
                          {t.amount != null ? formatVND(t.amount) : '-'}
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
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {modalOpen === 'inflow' ? 'Tiền vào' : 'Tiền ra'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
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
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Ghi chú"
                  />
                </div>
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
      </div>
    </div>
  );
}
