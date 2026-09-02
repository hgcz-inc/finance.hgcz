'use client';

import { useMemo, useState, useEffect } from 'react';
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
  stock_price: number | null;
  stock_cost: number | null;
  stock_profit: number | null;
}

type FilterType = 'month' | 'quarter' | 'year';

interface StockNavChartProps {
  reports: MonthlyReport[];
}

export default function StockNavChart({ reports }: StockNavChartProps) {
  const { currency } = useCurrency();
  const [filterType, setFilterType] = useState<FilterType>('month');

  const formatDate = (dateString: string, type: FilterType) => {
    const date = new Date(dateString);
    if (type === 'month') {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    } else if (type === 'quarter') {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    } else {
      return date.getFullYear().toString();
    }
  };

  const formatCurrency = (value: number) => {
    return formatCompactMoney(value, currency);
  };

  // Filter and process data
  const chartData = useMemo(() => {
    if (!reports || reports.length === 0) {
      return { labels: [], stockPrice: [], stockCost: [], stockProfit: [] };
    }

    // Filter out reports where stock_cost is 0 or null
    const filteredReports = reports
      .filter((report) => report.report_date && report.stock_cost && report.stock_cost !== 0)
      .sort((a, b) => {
        const dateA = new Date(a.report_date!).getTime();
        const dateB = new Date(b.report_date!).getTime();
        return dateA - dateB;
      });

    if (filteredReports.length === 0) {
      return { labels: [], stockPrice: [], stockCost: [], stockProfit: [] };
    }

    let processedData: {
      label: string;
      stockPrice: number;
      stockCost: number;
      stockProfit: number;
    }[] = [];

    if (filterType === 'month') {
      // Monthly data - use as is
      processedData = filteredReports.map((report) => ({
        label: formatDate(report.report_date!, 'month'),
        stockPrice: report.stock_price || 0,
        stockCost: report.stock_cost || 0,
        stockProfit: report.stock_profit || 0,
      }));
    } else if (filterType === 'quarter') {
      // Quarterly data - group by quarter
      const quarterMap = new Map<string, MonthlyReport[]>();

      filteredReports.forEach((report) => {
        const date = new Date(report.report_date!);
        const year = date.getFullYear();
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const key = `${year}-Q${quarter}`;

        if (!quarterMap.has(key)) {
          quarterMap.set(key, []);
        }
        quarterMap.get(key)!.push(report);
      });

      // Get the last report of each quarter
      quarterMap.forEach((reportsInQuarter, key) => {
        const lastReport = reportsInQuarter[reportsInQuarter.length - 1];
        processedData.push({
          label: key,
          stockPrice: lastReport.stock_price || 0,
          stockCost: lastReport.stock_cost || 0,
          stockProfit: lastReport.stock_profit || 0,
        });
      });
    } else if (filterType === 'year') {
      // Yearly data - group by year
      const yearMap = new Map<string, MonthlyReport[]>();

      filteredReports.forEach((report) => {
        const date = new Date(report.report_date!);
        const year = date.getFullYear().toString();

        if (!yearMap.has(year)) {
          yearMap.set(year, []);
        }
        yearMap.get(year)!.push(report);
      });

      // Get the last report of each year
      yearMap.forEach((reportsInYear, year) => {
        const lastReport = reportsInYear[reportsInYear.length - 1];
        processedData.push({
          label: year,
          stockPrice: lastReport.stock_price || 0,
          stockCost: lastReport.stock_cost || 0,
          stockProfit: lastReport.stock_profit || 0,
        });
      });
    }

    return {
      labels: processedData.map((d) => d.label),
      stockPrice: processedData.map((d) => d.stockPrice),
      stockCost: processedData.map((d) => d.stockCost),
      stockProfit: processedData.map((d) => d.stockProfit),
    };
  }, [reports, filterType]);

  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Giá trị trường',
        data: chartData.stockPrice,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: false,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Giá vốn',
        data: chartData.stockCost,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: false,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Lợi nhuận',
        data: chartData.stockProfit,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: false,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
            weight: 500,
          },
          padding: 15,
          usePointStyle: true,
          color: '#6B7280',
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
        bodySpacing: 6,
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatCurrency(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
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
        title: {
          display: true,
          text: `Value (${currency})`,
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

  const hasData = chartData.labels.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            📈 Stock NAV Chart
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Market Value, Cost, and Profit Over Time
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setFilterType('quarter')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'quarter'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Quarter
          </button>
          <button
            onClick={() => setFilterType('year')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'year'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Year
          </button>
        </div>
      </div>
      <div className="h-[300px] sm:h-[450px] w-full">
        {hasData ? (
          <Line data={data} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            No stock data available
          </div>
        )}
      </div>
    </div>
  );
}
