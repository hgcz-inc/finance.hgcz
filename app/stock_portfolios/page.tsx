'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface StockPortfolio {
  id: number;
  stock_code: string | null;
  shares_number: number | null;
  cost_price_per_share: number | null;
  price_per_share: number | null;
  total_cost_price: number | null;
  total_price: number | null;
  gain_loss_value: number | null;
  gain_loss_ratio: number | null;
  capital_structure: number | null;
  portfolio_w: number | null;
  status: 'profit' | 'break_even' | 'loss';
}

interface StockPortfolioTotals {
  total_cost_price: number | null;
  total_price: number | null;
  gain_loss_value: number | null;
  gain_loss_ratio: number | null;
}

interface PortfolioFormState {
  stock_code: string;
  shares_number: string;
  cost_price_per_share: string;
  price_per_share: string;
}

interface AccountRow {
  quantity: string;
  cost: string;
}

interface UpdatePricesResponse {
  success?: boolean;
  updated?: { stock_code: string; price_per_share: number }[];
  skipped?: string[];
  errors?: string[];
  error?: string;
}

const emptyForm: PortfolioFormState = {
  stock_code: '',
  shares_number: '',
  cost_price_per_share: '',
  price_per_share: '',
};

const emptyAccountRows = (): AccountRow[] =>
  Array.from({ length: 3 }, () => ({ quantity: '', cost: '' }));

function toNumber(value: number | null | undefined): number {
  return Number(value ?? 0);
}

function formatVND(value: number | null | undefined): string {
  return (
    new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(toNumber(value)) + ' ₫'
  );
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatPercent(value: number | null | undefined): string {
  return `${formatNumber(value)}%`;
}

function getStatusTextClass(status: StockPortfolio['status'] | undefined) {
  if (status === 'profit') return 'text-sky-600 dark:text-sky-400';
  if (status === 'loss') return 'text-red-600 dark:text-red-400';
  return 'text-amber-500 dark:text-amber-300';
}

export default function StockPortfoliosPage() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<StockPortfolio[]>([]);
  const [totals, setTotals] = useState<StockPortfolioTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] =
    useState<StockPortfolio | null>(null);
  const [form, setForm] = useState<PortfolioFormState>(emptyForm);
  const [accountRows, setAccountRows] = useState<AccountRow[]>(
    emptyAccountRows
  );
  const [saving, setSaving] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stock-portfolios');
      const data = await response.json();
      if (data.success) {
        setPortfolios(data.portfolios ?? []);
        setTotals(data.totals ?? null);
      } else {
        setErrorMessage(data.error || 'Không thể tải danh mục cổ phiếu.');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Không thể tải danh mục cổ phiếu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
      return;
    }

    fetchPortfolios();
  }, [router, fetchPortfolios]);

  const summaryItems = useMemo(
    () => [
      {
        label: 'Cost',
        value: formatVND(totals?.total_cost_price),
        className: 'text-gray-900 dark:text-white',
      },
      {
        label: 'Value',
        value: formatVND(totals?.total_price),
        className: 'text-gray-900 dark:text-white',
      },
      {
        label: 'Gain/Loss',
        value: formatVND(totals?.gain_loss_value),
        className:
          toNumber(totals?.gain_loss_value) >= 0
            ? 'text-sky-600 dark:text-sky-400'
            : 'text-red-600 dark:text-red-400',
      },
      {
        label: '+/-',
        value: formatPercent(totals?.gain_loss_ratio),
        className:
          toNumber(totals?.gain_loss_ratio) >= 0
            ? 'text-sky-600 dark:text-sky-400'
            : 'text-red-600 dark:text-red-400',
      },
    ],
    [totals]
  );

  const openCreateModal = () => {
    setEditingPortfolio(null);
    setForm(emptyForm);
    setAccountRows(emptyAccountRows());
    setSuccessMessage(null);
    setErrorMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (portfolio: StockPortfolio) => {
    setEditingPortfolio(portfolio);
    setForm({
      stock_code: portfolio.stock_code ?? '',
      shares_number: String(portfolio.shares_number ?? ''),
      cost_price_per_share: String(portfolio.cost_price_per_share ?? ''),
      price_per_share: String(portfolio.price_per_share ?? ''),
    });
    setAccountRows(emptyAccountRows());
    setSuccessMessage(null);
    setErrorMessage(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPortfolio(null);
    setForm(emptyForm);
    setAccountRows(emptyAccountRows());
    setSaving(false);
  };

  const updateFormField = (field: keyof PortfolioFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: field === 'stock_code' ? value.toUpperCase() : value,
    }));
  };

  const updateAccountRow = (
    index: number,
    field: keyof AccountRow,
    value: string
  ) => {
    setAccountRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const calculateMultipleAccounts = () => {
    const validRows = accountRows
      .map((row) => ({
        quantity: Number(row.quantity),
        cost: Number(row.cost),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.quantity) &&
          Number.isFinite(row.cost) &&
          row.quantity > 0 &&
          row.cost > 0
      );

    if (validRows.length === 0) {
      setErrorMessage('Vui lòng nhập ít nhất một dòng quantity và cost price.');
      return;
    }

    const totalQuantity = validRows.reduce(
      (sum, row) => sum + row.quantity,
      0
    );
    const totalValue = validRows.reduce(
      (sum, row) => sum + row.quantity * row.cost,
      0
    );
    const averageCost = totalValue / totalQuantity;

    setForm((current) => ({
      ...current,
      shares_number: String(Math.round(totalQuantity)),
      cost_price_per_share: averageCost.toFixed(2),
    }));
    setErrorMessage(null);
  };

  const validateForm = () => {
    const stockCode = form.stock_code.trim().toUpperCase();
    const sharesNumber = Number(form.shares_number);
    const costPricePerShare = Number(form.cost_price_per_share);
    const pricePerShare = Number(form.price_per_share);

    if (!stockCode) return 'Vui lòng nhập Symbol.';
    if (!Number.isFinite(sharesNumber) || sharesNumber <= 0) {
      return 'Vol phải lớn hơn 0.';
    }
    if (!Number.isFinite(costPricePerShare) || costPricePerShare < 0) {
      return 'Cost Prc phải lớn hơn hoặc bằng 0.';
    }
    if (!Number.isFinite(pricePerShare) || pricePerShare < 0) {
      return 'Price phải lớn hơn hoặc bằng 0.';
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const payload = {
        ...(editingPortfolio ? { id: editingPortfolio.id } : {}),
        stock_code: form.stock_code.trim().toUpperCase(),
        shares_number: Number(form.shares_number),
        cost_price_per_share: Number(form.cost_price_per_share),
        price_per_share: Number(form.price_per_share),
      };
      const response = await fetch('/api/stock-portfolios', {
        method: editingPortfolio ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (data.success) {
        setSuccessMessage(
          editingPortfolio ? 'Cập nhật thành công.' : 'Tạo mới thành công.'
        );
        closeModal();
        await fetchPortfolios();
      } else {
        setErrorMessage(data.error || 'Có lỗi xảy ra khi lưu danh mục.');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Có lỗi xảy ra khi lưu danh mục.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (portfolio: StockPortfolio) => {
    if (!window.confirm(`Delete ${portfolio.stock_code ?? 'this portfolio'}?`)) {
      return;
    }

    setDeletingId(portfolio.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/stock-portfolios?id=${portfolio.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage('Xoá thành công.');
        await fetchPortfolios();
      } else {
        setErrorMessage(data.error || 'Có lỗi xảy ra khi xoá danh mục.');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('Có lỗi xảy ra khi xoá danh mục.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdatePrices = async () => {
    setUpdatingPrices(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/stock-portfolios/update-prices', {
        method: 'POST',
      });
      const data = (await response.json()) as UpdatePricesResponse;
      if (data.success) {
        setSuccessMessage(
          `Đã cập nhật giá cho ${data.updated?.length ?? 0} mã cổ phiếu.`
        );
      } else {
        const details = data.errors?.length
          ? ` ${data.errors.join('; ')}`
          : data.error
            ? ` ${data.error}`
            : '';
        setErrorMessage(`Không thể cập nhật đầy đủ giá thị trường.${details}`);
      }
      if (data.skipped?.length) {
        setSuccessMessage(
          `Đã cập nhật ${data.updated?.length ?? 0} mã. Bỏ qua: ${data.skipped.join(', ')}.`
        );
      }
      await fetchPortfolios();
    } catch (error) {
      console.error(error);
      setErrorMessage('Có lỗi xảy ra khi cập nhật giá thị trường.');
    } finally {
      setUpdatingPrices(false);
    }
  };

  if (loading && portfolios.length === 0) {
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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Portfolios
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Current stock positions and market value.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm sm:text-base"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={handleUpdatePrices}
              disabled={updatingPrices || portfolios.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors text-sm sm:text-base"
            >
              {updatingPrices ? 'Updating...' : 'Update prices'}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm sm:text-base"
            >
              Create new
            </button>
          </div>
        </div>

        {(successMessage || errorMessage) && (
          <div className="mb-4 space-y-2">
            {successMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg bg-white dark:bg-gray-800 shadow p-4"
            >
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {item.label}
              </div>
              <div className={`mt-1 text-xl font-bold ${item.className}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-white dark:bg-gray-800 shadow-lg p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Portfolios
            </h2>
            {loading && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Refreshing...
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Symbol
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Vol
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Cost Prc
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Price
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Cost
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Value
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Gain/Loss
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    +/-
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Cap. structure
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Portfolio W.
                  </th>
                  <th className="py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {portfolios.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No stock portfolios yet
                    </td>
                  </tr>
                ) : (
                  portfolios.map((portfolio) => (
                    <tr
                      key={portfolio.id}
                      className="border-b border-gray-100 dark:border-gray-700"
                    >
                      <td
                        className={`py-3 px-2 font-semibold ${getStatusTextClass(portfolio.status)}`}
                      >
                        {portfolio.stock_code}
                      </td>
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {formatNumber(portfolio.shares_number)}
                      </td>
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {formatVND(portfolio.cost_price_per_share)}
                      </td>
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {formatVND(portfolio.price_per_share)}
                      </td>
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {formatVND(portfolio.total_cost_price)}
                      </td>
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {formatVND(portfolio.total_price)}
                      </td>
                      <td
                        className={`py-3 px-2 font-medium ${getStatusTextClass(portfolio.status)}`}
                      >
                        {formatVND(portfolio.gain_loss_value)}
                      </td>
                      <td
                        className={`py-3 px-2 font-medium ${getStatusTextClass(portfolio.status)}`}
                      >
                        {formatPercent(portfolio.gain_loss_ratio)}
                      </td>
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {formatPercent(portfolio.capital_structure)}
                      </td>
                      <td className="py-3 px-2 text-gray-900 dark:text-white">
                        {formatPercent(portfolio.portfolio_w)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(portfolio)}
                            className="px-3 py-1.5 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(portfolio)}
                            disabled={deletingId === portfolio.id}
                            className="px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                          >
                            {deletingId === portfolio.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {portfolios.length > 0 && (
                  <tr className="bg-gray-100 font-semibold dark:bg-gray-700">
                    <td className="py-3 px-2 text-gray-900 dark:text-white">
                      Σ
                    </td>
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2 text-gray-900 dark:text-white">
                      {formatVND(totals?.total_cost_price)}
                    </td>
                    <td className="py-3 px-2 text-gray-900 dark:text-white">
                      {formatVND(totals?.total_price)}
                    </td>
                    <td
                      className={`py-3 px-2 ${
                        toNumber(totals?.gain_loss_value) >= 0
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatVND(totals?.gain_loss_value)}
                    </td>
                    <td
                      className={`py-3 px-2 ${
                        toNumber(totals?.gain_loss_ratio) >= 0
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatPercent(totals?.gain_loss_ratio)}
                    </td>
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(event) =>
              event.target === event.currentTarget && closeModal()
            }
          >
            <div
              className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingPortfolio ? 'Edit Portfolio' : 'Create Portfolio'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Basic Info
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Symbol
                  </span>
                  <input
                    type="text"
                    value={form.stock_code}
                    onChange={(event) =>
                      updateFormField('stock_code', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 uppercase dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="FPT"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Vol
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.shares_number}
                    onChange={(event) =>
                      updateFormField('shares_number', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cost Prc
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_price_per_share}
                    onChange={(event) =>
                      updateFormField(
                        'cost_price_per_share',
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price_per_share}
                    onChange={(event) =>
                      updateFormField('price_per_share', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </label>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Multiple Accounts Calculation
                </h4>
                <div className="mt-3 space-y-3">
                  {accountRows.map((row, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.quantity}
                        onChange={(event) =>
                          updateAccountRow(
                            index,
                            'quantity',
                            event.target.value
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="Quantity"
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.cost}
                        onChange={(event) =>
                          updateAccountRow(index, 'cost', event.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="Cost Price"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={calculateMultipleAccounts}
                  className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Calculate
                </button>
              </div>

              {errorMessage && (
                <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
