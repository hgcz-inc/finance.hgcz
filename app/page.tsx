'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavChart from '@/components/NavChart';
import AssetsEquityChart from '@/components/AssetsEquityChart';
import CashflowChart from '@/components/CashflowChart';
import StockNavChart from '@/components/StockNavChart';
import StockDividendChart from '@/components/StockDividendChart';
import StockDividendByCodeChart from '@/components/StockDividendByCodeChart';
import ExpenseByCategoryChart from '@/components/ExpenseByCategoryChart';
import IncomeByCategoryChart from '@/components/IncomeByCategoryChart';
import FinancialIndicators from '@/components/FinancialIndicators';

interface MonthlyReport {
  id: number;
  report_date: string | null;
  stock_dividend: number | null;
  stock_gain_loss: number | null;
  stock_profit: number | null;
  stock_profit_rate: number | null;
  stock_cost: number | null;
  stock_price: number | null;
  stock_symbols: string | null;
  income: number | null;
  outcome: number | null;
  real_estate_cost: number | null;
  real_estate_price: number | null;
  real_estate_monthly_rent: number | null;
  cash: number | null;
  total_nav: number | null;
  stock_stack_dividend: number | null;
  crypto_cost: number | null;
  crypto_gain_loss: number | null;
  crypto_price: number | null;
  crypto_profit_rate: number | null;
  crypto_symbols: string | null;
  debt: number | null;
  created_at: string;
  updated_at: string;
}

interface CurrentUser {
  id?: number;
  login_id?: string;
}

export default function Home() {
  const router = useRouter();
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [monthlyReportModalOpen, setMonthlyReportModalOpen] = useState(false);
  const [reportCash, setReportCash] = useState('');
  const [reportDebt, setReportDebt] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSuccessMessage, setReportSuccessMessage] = useState<
    string | null
  >(null);
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    // Check if user is logged in
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
      return;
    }

    const userData = JSON.parse(userStr);
    setUser(userData);

    // Fetch monthly reports
    fetchMonthlyReports();
  }, [router]);

  const fetchMonthlyReports = async () => {
    try {
      const response = await fetch('/api/monthly-reports');
      const data = await response.json();

      if (data.success) {
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  const currentMonthLabel = new Intl.DateTimeFormat('vi-VN', {
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const openMonthlyReportModal = () => {
    setReportCash('');
    setReportDebt('');
    setReportSuccessMessage(null);
    setReportErrorMessage(null);
    setMonthlyReportModalOpen(true);
  };

  const closeMonthlyReportModal = () => {
    setMonthlyReportModalOpen(false);
    setReportErrorMessage(null);
    setReportSaving(false);
  };

  const handleCreateMonthlyReport = async () => {
    const cash = Number(reportCash);
    const debt = reportDebt.trim() === '' ? 0 : Number(reportDebt);

    if (!Number.isFinite(cash) || cash < 0) {
      setReportErrorMessage('Vui lòng nhập cash lớn hơn hoặc bằng 0.');
      return;
    }

    if (!Number.isFinite(debt) || debt < 0) {
      setReportErrorMessage('Vui lòng nhập debt lớn hơn hoặc bằng 0.');
      return;
    }

    setReportSaving(true);
    setReportErrorMessage(null);
    try {
      const response = await fetch('/api/monthly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cash, debt }),
      });
      const data = await response.json();

      if (data.success) {
        setReportSuccessMessage(
          data.action === 'updated'
            ? 'Đã cập nhật Monthly Report tháng này.'
            : 'Đã tạo Monthly Report tháng này.'
        );
        setMonthlyReportModalOpen(false);
        setReportCash('');
        setReportDebt('');
        await fetchMonthlyReports();
      } else {
        setReportErrorMessage(
          data.error || 'Có lỗi xảy ra khi tạo Monthly Report.'
        );
      }
    } catch (error) {
      console.error('Error creating monthly report:', error);
      setReportErrorMessage('Có lỗi xảy ra khi tạo Monthly Report.');
    } finally {
      setReportSaving(false);
    }
  };

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Welcome, {user?.login_id}
            </p>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <Link
              href="/cashflow_transactions"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              Transactions
            </Link>
            <Link
              href="/stock_portfolios"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              Stock
            </Link>
            <button
              type="button"
              onClick={openMonthlyReportModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              Monthly Report
            </button>
            <Link
              href="/configuration"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm sm:text-base dark:bg-gray-600 dark:hover:bg-gray-500"
            >
              Config
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base"
            >
              Logout
            </button>
          </div>
        </div>

        {reportSuccessMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
            {reportSuccessMessage}
          </div>
        )}

        {/* Dashboard Content */}
        <div className="space-y-6">
          {/* NAV Chart */}
          <NavChart reports={reports} />

          {/* Assets and Owner's Equity Chart */}
          <AssetsEquityChart reports={reports} />

          {/* Financial Indicators */}
          <FinancialIndicators reports={reports} />

          {/* Cashflow Chart */}
          <CashflowChart reports={reports} />

          {/* Stock NAV Chart */}
          <StockNavChart reports={reports} />

          {/* Stock Dividend Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Stock Cash Dividends - col-md-8 on desktop, col-md-12 on mobile */}
            <div className="md:col-span-8">
              <StockDividendChart />
            </div>

            {/* Cash Dividend by Stock Code - col-md-4 on desktop, col-md-12 on mobile */}
            <div className="md:col-span-4">
              <StockDividendByCodeChart />
            </div>
          </div>

          {/* Expense by Category Chart */}
          <ExpenseByCategoryChart />

          {/* Income by Category Chart */}
          <IncomeByCategoryChart />
        </div>

        {monthlyReportModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(event) =>
              event.target === event.currentTarget && closeMonthlyReportModal()
            }
          >
            <div
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Monthly Report
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {currentMonthLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeMonthlyReportModal}
                  className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cash
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reportCash}
                    onChange={(event) => setReportCash(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Debt
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reportDebt}
                    onChange={(event) => setReportDebt(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </label>
              </div>

              {reportErrorMessage && (
                <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                  {reportErrorMessage}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeMonthlyReportModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleCreateMonthlyReport}
                  disabled={reportSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {reportSaving ? 'Đang lưu...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
