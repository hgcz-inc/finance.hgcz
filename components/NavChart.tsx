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
import { useCurrency } from '@/components/CurrencyProvider';
import { formatCompactMoney } from '@/lib/currency';

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
  const { currency } = useCurrency();
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

    if (sortedReports.length === 0) {
      return { labels: [], grouped: {} };
    }

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
          totalNav: report.total_nav ?? 0,
          stockPrice: report.stock_price ?? 0,
          realEstatePrice: report.real_estate_price ?? 0,
          cash: report.cash ?? 0,
          cryptoPrice: report.crypto_price ?? 0,
          debt: report.debt ?? 0,
          date,
        };
      }
    });

    // Generate all possible labels from min to max date
    const firstDate = new Date(sortedReports[0].report_date!);
    const lastDate = new Date(sortedReports[sortedReports.length - 1].report_date!);

    // Normalize first date to start of period
    const startDate = new Date(firstDate);
    switch (timeRange) {
      case 'month':
        startDate.setDate(1);
        break;
      case 'quarter':
        startDate.setMonth(Math.floor(startDate.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate.setMonth(0, 1);
        break;
    }

    const allLabels: string[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= lastDate) {
      let key: string;

      switch (timeRange) {
        case 'month': {
          key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          // Move to next month
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        }
        case 'quarter': {
          const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
          key = `${currentDate.getFullYear()}-Q${quarter}`;
          // Move to next quarter
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
        }
        case 'year': {
          key = String(currentDate.getFullYear());
          // Move to next year
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        }
        default: {
          key = String(currentDate.getFullYear());
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
      }

      if (!allLabels.includes(key)) {
        allLabels.push(key);
      }

      // Fill with 0 if no data exists for this period
      if (!grouped[key]) {
        grouped[key] = {
          totalNav: 0,
          stockPrice: 0,
          realEstatePrice: 0,
          cash: 0,
          cryptoPrice: 0,
          debt: 0,
          date: new Date(currentDate),
        };
      }
    }

    // Sort labels properly
    const labels = allLabels.sort((a, b) => {
      // For year format: just compare numbers
      if (timeRange === 'year') {
        return parseInt(a) - parseInt(b);
      }
      // For month format: "YYYY-MM"
      if (timeRange === 'month') {
        return a.localeCompare(b);
      }
      // For quarter format: "YYYY-Q1"
      if (timeRange === 'quarter') {
        const [yearA, quarterA] = a.split('-Q');
        const [yearB, quarterB] = b.split('-Q');
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        return parseInt(quarterA) - parseInt(quarterB);
      }
      return a.localeCompare(b);
    });

    return { labels, grouped };
  }, [reports, timeRange]);

  const formatCurrency = (value: number) => {
    return formatCompactMoney(value, currency);
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
    data: number[],
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
    pointRadius: 3,
    pointHoverRadius: 5,
    pointBackgroundColor: color.point,
    pointBorderColor: '#fff',
    pointBorderWidth: 2,
    pointHoverBackgroundColor: color.hover,
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 3,
    spanGaps: false,
  });

  const data = {
    labels: chartData.labels,
    datasets: [
      createDataset(
        'Total NAV',
        chartData.labels.map((label) => chartData.grouped[label]?.totalNav ?? 0),
        colors.totalNav,
        true
      ),
      createDataset(
        'Stock NAV',
        chartData.labels.map((label) => chartData.grouped[label]?.stockPrice ?? 0),
        colors.stock
      ),
      createDataset(
        'Real Estate NAV',
        chartData.labels.map((label) => chartData.grouped[label]?.realEstatePrice ?? 0),
        colors.realEstate
      ),
      createDataset(
        'Cash',
        chartData.labels.map((label) => chartData.grouped[label]?.cash ?? 0),
        colors.cash
      ),
      createDataset(
        'Crypto',
        chartData.labels.map((label) => chartData.grouped[label]?.cryptoPrice ?? 0),
        colors.crypto
      ),
      createDataset(
        'Debt',
        chartData.labels.map((label) => chartData.grouped[label]?.debt ?? 0),
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
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (value === null || value === undefined || value === 0) {
              return `${label}: ${formatCurrency(0)}`;
            }
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
            NAV Breakdown
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
      <div className="h-[250px] sm:h-[300px] w-full">
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
