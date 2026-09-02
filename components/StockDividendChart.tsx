'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useCurrency } from '@/components/CurrencyProvider';
import { formatCompactMoney } from '@/lib/currency';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface StockDividend {
  id: number;
  current_shares_number: number | null;
  dividend_type: number;
  ex_dividend_date: string | null;
  net_dividends_received: number | null;
  payment_date: string | null;
  purpose: string | null;
  ratio: number | null;
  stock_code: string | null;
  created_at: string;
  updated_at: string;
}

type TimeRange = 'month' | 'year';

export default function StockDividendChart() {
  const { currency } = useCurrency();
  const [timeRange, setTimeRange] = useState<TimeRange>('year');
  const [dividends, setDividends] = useState<StockDividend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDividends();
  }, []);

  const fetchDividends = async () => {
    try {
      const response = await fetch('/api/stock-dividends');
      const data = await response.json();

      if (data.success) {
        setDividends(data.dividends);
      }
    } catch (error) {
      console.error('Error fetching dividends:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group and aggregate data based on time range
  const chartData = useMemo(() => {
    if (!dividends || dividends.length === 0) {
      return { labels: [], grouped: {} };
    }

    // Filter and sort by payment_date (date when money is received)
    const filteredDividends = dividends
      .filter((d) => d.payment_date && d.net_dividends_received !== null)
      .sort(
        (a, b) =>
          new Date(a.payment_date!).getTime() -
          new Date(b.payment_date!).getTime()
      );

    if (filteredDividends.length === 0) {
      return { labels: [], grouped: {} };
    }

    const grouped: { [key: string]: number } = {};

    filteredDividends.forEach((dividend) => {
      if (!dividend.payment_date || dividend.net_dividends_received === null) {
        return;
      }

      const date = new Date(dividend.payment_date);
      let key: string;

      switch (timeRange) {
        case 'month':
          // Format: "M/YYYY" to match other charts
          key = `${date.getMonth() + 1}/${date.getFullYear()}`;
          break;
        case 'year':
          key = String(date.getFullYear());
          break;
        default:
          key = String(date.getFullYear());
      }

      // Sum net_dividends_received for each period
      if (!grouped[key]) {
        grouped[key] = 0;
      }
      grouped[key] += dividend.net_dividends_received;
    });

    // Only include periods that have data (don't fill with 0)
    const labels = Object.keys(grouped).sort((a, b) => {
      // For year format: just compare numbers
      if (timeRange === 'year') {
        return parseInt(a) - parseInt(b);
      }
      // For month format: "M/YYYY"
      if (timeRange === 'month') {
        const [monthA, yearA] = a.split('/');
        const [monthB, yearB] = b.split('/');
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        return parseInt(monthA) - parseInt(monthB);
      }
      return a.localeCompare(b);
    });

    return { labels, grouped };
  }, [dividends, timeRange]);

  const formatCurrency = (value: number) => {
    return formatCompactMoney(value, currency);
  };

  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Cash Dividends',
        data: chartData.labels.map((label) => chartData.grouped[label] ?? 0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: 500,
          },
          boxWidth: 12,
          boxHeight: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function (context: any) {
            const value = context.parsed.y;
            return `Total: ${formatCurrency(value)}`;
          },
        },
        displayColors: true,
        multiKeyBackground: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          callback: function (value: any) {
            return formatCurrency(value);
          },
          color: '#6B7280',
          font: {
            size: 11,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 11,
          },
        },
      },
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const,
    },
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="h-[250px] sm:h-[300px] flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  const hasData = chartData.labels.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Stock Cash Dividends
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === 'month'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setTimeRange('year')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === 'year'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Year
          </button>
        </div>
      </div>
      <div className="h-[250px] sm:h-[300px] w-full">
        {hasData ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            No dividend data available
          </div>
        )}
      </div>
    </div>
  );
}
