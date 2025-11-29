'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavChart from '@/components/NavChart';
import AssetsEquityChart from '@/components/AssetsEquityChart';

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

export default function Home() {
  const router = useRouter();
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

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
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm sm:text-base self-start sm:self-auto"
          >
            Logout
          </button>
        </div>

        {/* Dashboard Content */}
        <div className="space-y-6">
          {/* NAV Chart */}
          <NavChart reports={reports} />

          {/* Assets and Owner's Equity Chart */}
          <AssetsEquityChart reports={reports} />
        </div>
      </div>
    </div>
  );
}
