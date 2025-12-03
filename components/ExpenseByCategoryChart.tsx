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

interface ExpenseTransaction {
  id: number;
  amount: number | null;
  categorizable_type: string;
  kind: number;
  note: string | null;
  transaction_date: string | null;
  category_name: string;
  category_id: number;
}

// Category icons mapping
const categoryIcons: { [key: number]: string } = {
  1: '🍔', // Food & Beverage
  2: '💡', // Bills & Utilities
  3: '🚗', // Transportation
  4: '📚', // Education
  5: '📈', // Investment
  6: '🛍️', // Shopping
  7: '🎬', // Entertainment
  8: '💪', // Health & Fitness
  9: '🎁', // Gifts & Donations
  10: '📦', // Other Expense
  11: '🏠', // Home Rent
};

// Category name mapping
const categoryNames: { [key: number]: string } = {
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

export default function ExpenseByCategoryChart() {
  const [transactions, setTransactions] = useState<ExpenseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

  // Fetch available years on mount
  useEffect(() => {
    fetch('/api/expense-by-category')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.transactions.length > 0) {
          const years = new Set<number>();
          data.transactions.forEach((t: ExpenseTransaction) => {
            if (t.transaction_date) {
              years.add(new Date(t.transaction_date).getFullYear());
            }
          });
          const sortedYears = Array.from(years).sort((a, b) => b - a);
          setAvailableYears(sortedYears);
          if (sortedYears.length > 0 && !sortedYears.includes(selectedYear)) {
            setSelectedYear(sortedYears[0]); // Set to most recent year
          }
        }
      })
      .catch((err) => console.error('Error fetching years:', err));
  }, []);

  useEffect(() => {
    fetchExpenses(selectedYear);
  }, [selectedYear]);

  const fetchExpenses = async (year: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/expense-by-category?year=${year}`);
      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group and aggregate by category
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { categories: [], totals: {}, grandTotal: 0 };
    }

    const grouped: { [key: number]: { name: string; total: number; icon: string } } = {};
    let grandTotal = 0;

    transactions.forEach((transaction) => {
      if (transaction.amount === null || !transaction.category_id) {
        return;
      }

      const categoryId = transaction.category_id;
      const categoryName = categoryNames[categoryId] || transaction.category_name || 'Unknown';
      const icon = categoryIcons[categoryId] || '📦';
      const amount = Math.abs(transaction.amount);

      if (!grouped[categoryId]) {
        grouped[categoryId] = {
          name: categoryName,
          total: 0,
          icon,
        };
      }

      grouped[categoryId].total += amount;
      grandTotal += amount;
    });

    // Sort by total amount (descending) and get category IDs
    const categoryIds = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => grouped[b].total - grouped[a].total);

    return { categories: categoryIds, totals: grouped, grandTotal };
  }, [transactions]);

  const formatCurrency = (value: number) => {
    // Format in triệu đ (millions)
    const millions = value / 1_000_000;
    return `${millions.toFixed(1)} triệu đ`;
  };

  const data = {
    labels: chartData.categories.map((id) => {
      const category = chartData.totals[id];
      return `${category.icon} ${category.name}`;
    }),
    datasets: [
      {
        label: 'Expense',
        data: chartData.categories.map((id) => chartData.totals[id]?.total ?? 0),
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
        display: false, // Hide legend
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
            const percentage = chartData.grandTotal > 0
              ? ((value / chartData.grandTotal) * 100).toFixed(1)
              : '0.0';
            return [
              `Amount: ${formatCurrency(value)}`,
              `Percentage: ${percentage}%`
            ];
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
            return formatCurrency(value);
          },
          color: '#6B7280',
          font: {
            size: 11,
          },
        },
        title: {
          display: true,
          text: 'Expense (triệu đ)',
          color: '#6B7280',
          font: {
            size: 12,
            weight: 500,
          },
        },
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
        <div className="h-[250px] sm:h-[400px] flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  const hasData = chartData.categories.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Expense by Category
          </h2>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-600 dark:text-gray-400">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            {availableYears.length > 0 ? (
              availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))
            ) : (
              <option value={selectedYear}>{selectedYear}</option>
            )}
          </select>
        </div>
      </div>
      <div className="h-[250px] sm:h-[400px] w-full">
        {hasData ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            No expense data available for {selectedYear}
          </div>
        )}
      </div>
    </div>
  );
}
