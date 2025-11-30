'use client';

import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MonthlyReport {
  id: number;
  report_date: string | null;
  total_nav: number | null;
  debt: number | null;
}

type TimeRange = 'quarter' | 'year';

interface AssetsEquityChartProps {
  reports: MonthlyReport[];
}

interface GroupedData {
  assets: number;
  debt: number;
  date: Date;
  growthRate?: number | null; // % tăng trưởng so với năm trước
}

export default function AssetsEquityChart({ reports }: AssetsEquityChartProps) {
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
          assets: report.total_nav ?? 0,
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
          assets: 0,
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

    // Calculate growth rate (%) for each year compared to previous year
    if (timeRange === 'year') {
      labels.forEach((label, index) => {
        if (index === 0) {
          // First year has no previous year
          grouped[label].growthRate = null;
          return;
        }

        const currentYear = parseInt(label);
        const previousYear = currentYear - 1;
        const previousYearKey = String(previousYear);

        const currentAssets = grouped[label]?.assets ?? 0;
        const previousAssets = grouped[previousYearKey]?.assets ?? 0;

        if (previousAssets === 0 || !grouped[previousYearKey]) {
          // No previous year data or previous assets is 0
          grouped[label].growthRate = null;
          return;
        }

        // Calculate growth rate: ((current - previous) / previous) * 100
        const growthRate = ((currentAssets - previousAssets) / previousAssets) * 100;
        grouped[label].growthRate = growthRate;
      });
    }

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

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Prepare datasets
  const datasets: any[] = [
    {
      type: 'bar' as const,
      label: 'Debt',
      data: chartData.labels.map((label) => chartData.grouped[label]?.debt ?? 0),
      backgroundColor: 'rgba(239, 68, 68, 0.8)',
      borderColor: 'rgb(239, 68, 68)',
      borderWidth: 1,
      yAxisID: 'y',
    },
    {
      type: 'bar' as const,
      label: 'Assets',
      data: chartData.labels.map((label) => chartData.grouped[label]?.assets ?? 0),
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
      borderColor: 'rgb(34, 197, 94)',
      borderWidth: 1,
      yAxisID: 'y',
    },
  ];

  // Add growth rate line only for year view
  if (timeRange === 'year') {
    datasets.push({
      type: 'line' as const,
      label: 'Growth Rate (%)',
      data: chartData.labels.map((label) => {
        const growthRate = chartData.grouped[label]?.growthRate;
        return growthRate !== null && growthRate !== undefined ? growthRate : null;
      }),
      borderColor: 'rgb(168, 85, 247)',
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      borderWidth: 3,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: 'rgb(168, 85, 247)',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointHoverBackgroundColor: 'rgb(147, 51, 234)',
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 3,
      tension: 0.4,
      fill: false,
      spanGaps: true,
      yAxisID: 'y1',
    });
  }

  const data = {
    labels: chartData.labels,
    datasets,
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

            // Check if this is the growth rate dataset
            if (label === 'Growth Rate (%)') {
              if (value === null || value === undefined) {
                return `${label}: N/A`;
              }
              return `${label}: ${formatPercentage(value)}`;
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
        type: 'linear' as const,
        position: 'left' as const,
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
      y1: timeRange === 'year' ? {
        type: 'linear' as const,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: function (value: any) {
            return formatPercentage(value);
          },
          color: 'rgb(168, 85, 247)',
          font: {
            size: 11,
            weight: 600,
          },
        },
      } : undefined,
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

  const hasData = chartData.labels.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Assets and Owner&apos;s Equity
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
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
          <Chart type="bar" data={data} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            No data available for the selected time range
          </div>
        )}
      </div>
    </div>
  );
}
