'use client';

import { useMemo } from 'react';

interface MonthlyReport {
  id: number;
  report_date: string | null;
  total_nav: number | null;
  debt: number | null;
  stock_price: number | null;
  real_estate_price: number | null;
  crypto_price: number | null;
}

interface FinancialIndicatorsProps {
  reports: MonthlyReport[];
}

interface YearData {
  year: number;
  totalNavStart: number;
  totalNavEnd: number;
  debtStart: number;
  debtEnd: number;
  roe: number | null;
  roa: number | null;
  roic: number | null;
}

export default function FinancialIndicators({ reports }: FinancialIndicatorsProps) {
  const yearData = useMemo(() => {
    if (!reports || reports.length === 0) {
      return [];
    }

    // Filter and sort reports by date
    const sortedReports = [...reports]
      .filter((r) => r.report_date && r.total_nav !== null)
      .sort(
        (a, b) =>
          new Date(a.report_date!).getTime() - new Date(b.report_date!).getTime()
      );

    if (sortedReports.length === 0) {
      return [];
    }

    // Group reports by year
    const groupedByYear: { [year: number]: typeof sortedReports } = {};

    sortedReports.forEach((report) => {
      const date = new Date(report.report_date!);
      const year = date.getFullYear();

      if (!groupedByYear[year]) {
        groupedByYear[year] = [];
      }
      groupedByYear[year].push(report);
    });

    // Calculate ROE for each year
    const years = Object.keys(groupedByYear)
      .map(Number)
      .sort((a, b) => a - b);

    const result: YearData[] = [];

    years.forEach((year) => {
      const yearReports = groupedByYear[year];

      // Get first and last reports of the year
      const firstReport = yearReports[0];
      const lastReport = yearReports[yearReports.length - 1];

      const totalNavStart = firstReport.total_nav ?? 0;
      const totalNavEnd = lastReport.total_nav ?? 0;
      const debtStart = firstReport.debt ?? 0;
      const debtEnd = lastReport.debt ?? 0;
      const totalInvestmentCapitalStart = (firstReport.stock_price ?? 0) + (firstReport.real_estate_price ?? 0) + (firstReport.crypto_price ?? 0);

      // Calculate debt phát sinh mới (new debt incurred during the year)
      const debtNewIncurred = Math.max(0, debtEnd - debtStart);

      // Calculate ROE
      // ROE = (total_nav cuối năm - total_nav đầu năm - debt phát sinh mới) / (total_nav đầu năm - debt đầu năm) * 100
      const ownerEquityStart = totalNavStart - debtStart;

      let roe: number | null = null;
      let roa: number | null = null;
      let roic: number | null = null;

      const numerator = totalNavEnd - totalNavStart - debtNewIncurred;
      if (ownerEquityStart > 0) {
        roe = (numerator / ownerEquityStart) * 100;
      }
      if (totalNavStart > 0) {
        roa = (numerator / totalNavStart) * 100;
      }
      if (totalInvestmentCapitalStart > 0) {
        roic = (numerator / totalInvestmentCapitalStart) * 100;
      }

      result.push({
        year,
        totalNavStart,
        totalNavEnd,
        debtStart,
        debtEnd,
        roe,
        roa,
        roic
      });
    });

    return result;
  }, [reports]);

  const formatPercentage = (value: number | null) => {
    if (value === null || isNaN(value)) {
      return 'N/A';
    }
    return `${value.toFixed(2)}%`;
  };

  if (yearData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Financial Indicators
        </h2>
        <div className="text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Financial Indicators
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th>Indicator</th>
              {yearData.map((data) => (
                <th
                  key={data.year}
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border-l border-gray-200 dark:border-gray-700 first:border-l-0"
                >
                  {data.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3 text-center text-sm border-l border-gray-200 dark:border-gray-700 first:border-l-0">ROE</td>
              {yearData.map((data) => (
                <td
                  key={data.year}
                  className={`px-4 py-3 text-center text-sm border-l border-gray-200 dark:border-gray-700 first:border-l-0 ${
                    data.roe !== null
                      ? data.roe >= 0
                        ? 'text-green-600 dark:text-green-400 font-semibold'
                        : 'text-red-600 dark:text-red-400 font-semibold'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {formatPercentage(data.roe)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-center text-sm border-l border-gray-200 dark:border-gray-700 first:border-l-0">ROA</td>
              {yearData.map((data) => (
                <td
                  key={data.year}
                  className={`px-4 py-3 text-center text-sm border-l border-gray-200 dark:border-gray-700 first:border-l-0 ${
                    data.roa !== null
                      ? data.roa >= 0
                        ? 'text-green-600 dark:text-green-400 font-semibold'
                        : 'text-red-600 dark:text-red-400 font-semibold'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {formatPercentage(data.roa)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-center text-sm border-l border-gray-200 dark:border-gray-700 first:border-l-0">ROIC</td>
              {yearData.map((data) => (
                <td
                  key={data.year}
                  className={`px-4 py-3 text-center text-sm border-l border-gray-200 dark:border-gray-700 first:border-l-0 ${
                    data.roic !== null
                      ? data.roic >= 0
                        ? 'text-green-600 dark:text-green-400 font-semibold'
                        : 'text-red-600 dark:text-red-400 font-semibold'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {formatPercentage(data.roic)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
