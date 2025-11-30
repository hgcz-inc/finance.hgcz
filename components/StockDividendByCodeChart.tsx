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

export default function StockDividendByCodeChart() {
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

  // Group and aggregate by stock_code
  const chartData = useMemo(() => {
    if (!dividends || dividends.length === 0) {
      return { stockCodes: [], totals: {} };
    }

    // Filter and aggregate by stock_code
    const grouped: { [key: string]: number } = {};

    dividends.forEach((dividend) => {
      if (!dividend.stock_code || dividend.net_dividends_received === null) {
        return;
      }

      const stockCode = dividend.stock_code;

      // Sum net_dividends_received for each stock_code
      if (!grouped[stockCode]) {
        grouped[stockCode] = 0;
      }
      grouped[stockCode] += dividend.net_dividends_received;
    });

    // Sort by total dividend amount (descending)
    const stockCodes = Object.keys(grouped).sort((a, b) => {
      return grouped[b] - grouped[a];
    });

    return { stockCodes, totals: grouped };
  }, [dividends]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    // Format in triệu đ (millions)
    const millions = value / 1_000_000;
    return `${millions.toFixed(1)} triệu đ`;
  };

  const data = {
    labels: chartData.stockCodes,
    datasets: [
      {
        label: 'Cash Dividend',
        data: chartData.stockCodes.map((code) => chartData.totals[code] ?? 0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const, // Horizontal bar chart
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend since there's only one dataset
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
            const value = context.parsed.x;
            return `Total: ${formatCurrency(value)}`;
          },
        },
        displayColors: false,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          callback: function (value: any) {
            return formatCurrencyFull(value);
          },
          color: '#6B7280',
          font: {
            size: 11,
          },
        }
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 12,
            weight: 500,
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

  const hasData = chartData.stockCodes.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Cash Dividend by Stock Code
        </h2>
      </div>
      <div className="h-[250px] sm:h-[350px] w-full">
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
