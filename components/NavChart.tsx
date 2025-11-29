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
}

type TimeRange = 'month' | 'quarter' | 'year';

interface NavChartProps {
  reports: MonthlyReport[];
}

export default function NavChart({ reports }: NavChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('year');

  // Filter and group data based on time range
  const chartData = useMemo(() => {
    if (!reports || reports.length === 0) {
      return { labels: [], values: [] };
    }

    // Sort reports by date
    const sortedReports = [...reports]
      .filter((r) => r.report_date && r.total_nav !== null)
      .sort(
        (a, b) =>
          new Date(a.report_date!).getTime() -
          new Date(b.report_date!).getTime()
      );

    const grouped: { [key: string]: { value: number; date: Date } } = {};

    sortedReports.forEach((report) => {
      if (!report.report_date || report.total_nav === null) return;

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
        grouped[key] = { value: report.total_nav, date };
      }
    });

    const labels = Object.keys(grouped).sort();
    const values = labels.map((label) => grouped[label].value);

    return { labels, values };
  }, [reports, timeRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Total NAV',
        data: chartData.values,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: 'rgb(37, 99, 235)',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
            return `NAV: ${formatCurrency(context.parsed.y)}`;
          },
        },
        displayColors: false,
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Total NAV Chart
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Net Asset Value over time
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
        {chartData.values.length > 0 ? (
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
