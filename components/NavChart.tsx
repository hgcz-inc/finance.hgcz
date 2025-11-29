'use client';

import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MonthlyReport {
  id: number;
  report_date: string | null;
  total_nav: number | null;
  stock_price: number | null;
  real_estate_price: number | null;
  cash: number | null;
  crypto_price: number | null;
  debt: number | null;
}

type TimeRange = 'month' | 'quarter' | 'year';

interface NavChartProps {
  reports: MonthlyReport[];
}

interface GroupedData {
  totalNav: number | null;
  stockPrice: number | null;
  realEstatePrice: number | null;
  cash: number | null;
  cryptoPrice: number | null;
  debt: number | null;
  date: Date;
}

export default function NavChart({ reports }: NavChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('year');

  // Filter and group data based on time range
  const chartData = useMemo(() => {
    if (!reports || reports.length === 0) {
      return { labels: [], grouped: {} };
    }

    // Sort reports by date
    const sortedReports = [...reports]
      .filter((r) => r.report_date)
      .sort(
        (a, b) =>
          new Date(a.report_date!).getTime() -
          new Date(b.report_date!).getTime()
      );

    const grouped: { [key: string]: GroupedData } = {};

    sortedReports.forEach((report) => {
      if (!report.report_date) return;

      const date = new Date(report.report_date);
      let key: string;

      switch (timeRange) {
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            '0'
          )}`;
          break;
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'year':
          key = String(date.getFullYear());
          break;
        default:
          key = String(date.getFullYear());
      }

      // Use the latest value for each group
      if (!grouped[key] || date > grouped[key].date) {
        grouped[key] = {
          totalNav: report.total_nav,
          stockPrice: report.stock_price,
          realEstatePrice: report.real_estate_price,
          cash: report.cash,
          cryptoPrice: report.crypto_price,
          debt: report.debt,
          date,
        };
      }
    });

    const labels = Object.keys(grouped).sort();

    return { labels, grouped };
  }, [reports, timeRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  // Color palette for different lines
  const colors = {
    totalNav: {
      border: 'rgb(59, 130, 246)',
      background: 'rgba(59, 130, 246, 0.1)',
      point: 'rgb(59, 130, 246)',
      hover: 'rgb(37, 99, 235)',
    },
    stock: {
      border: 'rgb(34, 197, 94)',
      background: 'rgba(34, 197, 94, 0.1)',
      point: 'rgb(34, 197, 94)',
      hover: 'rgb(22, 163, 74)',
    },
    realEstate: {
      border: 'rgb(249, 115, 22)',
      background: 'rgba(249, 115, 22, 0.1)',
      point: 'rgb(249, 115, 22)',
      hover: 'rgb(234, 88, 12)',
    },
    cash: {
      border: 'rgb(107, 114, 128)',
      background: 'rgba(107, 114, 128, 0.1)',
      point: 'rgb(107, 114, 128)',
      hover: 'rgb(75, 85, 99)',
    },
    crypto: {
      border: 'rgb(168, 85, 247)',
      background: 'rgba(168, 85, 247, 0.1)',
      point: 'rgb(168, 85, 247)',
      hover: 'rgb(147, 51, 234)',
    },
    debt: {
      border: 'rgb(239, 68, 68)',
      background: 'rgba(239, 68, 68, 0.1)',
      point: 'rgb(239, 68, 68)',
      hover: 'rgb(220, 38, 38)',
    },
  };

  const createDataset = (
    label: string,
    data: (number | null)[],
    color: typeof colors.totalNav,
    fill = false
  ) => ({
    label,
    data,
    borderColor: color.border,
    backgroundColor: color.background,
    borderWidth: 2.5,
    fill,
    tension: 0.4,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBackgroundColor: color.point,
    pointBorderColor: '#fff',
    pointBorderWidth: 2,
    pointHoverBackgroundColor: color.hover,
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 3,
  });

  const data = {
    labels: chartData.labels,
    datasets: [
      createDataset(
        'Total NAV',
        chartData.labels.map((label) => chartData.grouped[label]?.totalNav ?? null),
        colors.totalNav,
        true
      ),
      createDataset(
        'Stock NAV',
        chartData.labels.map((label) => chartData.grouped[label]?.stockPrice ?? null),
        colors.stock
      ),
      createDataset(
        'Real Estate NAV',
        chartData.labels.map((label) => chartData.grouped[label]?.realEstatePrice ?? null),
        colors.realEstate
      ),
      createDataset(
        'Cash',
        chartData.labels.map((label) => chartData.grouped[label]?.cash ?? null),
        colors.cash
      ),
      createDataset(
        'Crypto',
        chartData.labels.map((label) => chartData.grouped[label]?.cryptoPrice ?? null),
        colors.crypto
      ),
      createDataset(
        'Debt',
        chartData.labels.map((label) => chartData.grouped[label]?.debt ?? null),
        colors.debt
      ),
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
            weight: '500' as const,
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
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (value === null || value === undefined) return `${label}: N/A`;
            return `${label}: ${formatCurrency(value)}`;
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
        beginAtZero: false,
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
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const,
    },
  };

  const hasData = chartData.labels.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            NAV Breakdown Chart
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Net Asset Value breakdown over time
          </p>
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
            onClick={() => setTimeRange('quarter')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === 'quarter'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Quarter
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
      <div className="h-[300px] sm:h-[400px] lg:h-[500px] w-full">
        {hasData ? (
          <Line data={data} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            No data available for the selected time range
          </div>
        )}
      </div>
    </div>
  );
}
