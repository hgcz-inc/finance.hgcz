import { query } from '@/lib/db';

export interface MonthlyReportCalculation {
  report_date: string;
  income: number;
  outcome: number;
  real_estate_cost: number;
  real_estate_monthly_rent: number | null;
  real_estate_price: number;
  stock_cost: number;
  stock_price: number;
  stock_dividend: number;
  stock_gain_loss: number;
  stock_profit: number;
  stock_profit_rate: number;
  stock_symbols: string;
  stock_stack_dividend: number;
  crypto_cost: number;
  crypto_price: number;
  crypto_gain_loss: number;
  crypto_profit_rate: number;
  crypto_symbols: string;
}

function toNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthRange(reportDate: Date) {
  const year = reportDate.getFullYear();
  const month = reportDate.getMonth();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);

  return {
    reportDate: toDateString(reportDate),
    startDate: toDateString(startDate),
    endDate: toDateString(endDate),
  };
}

function calcStockProfitRate(stockProfit: number, stockCost: number): number {
  if (stockCost === 0) return 0;

  if (stockProfit < 0) {
    return round(-(100 - (stockProfit / stockCost) * 100), 1);
  }

  return round((stockProfit / stockCost) * 100, 1);
}

function calcCryptoProfitRate(
  cryptoGainLoss: number,
  cryptoPrice: number,
  cryptoCost: number
): number {
  if (cryptoCost === 0) return 0;

  if (cryptoGainLoss < 0) {
    return round(-(100 - (cryptoPrice / cryptoCost) * 100), 2);
  }

  return round((cryptoPrice / cryptoCost) * 100, 2);
}

export async function buildMonthlyReport(
  userId: number,
  reportDate = new Date(),
  excludeMonthlyReportId?: number
): Promise<MonthlyReportCalculation> {
  const { reportDate: reportDateString, startDate, endDate } =
    monthRange(reportDate);

  const [
    cashflowResult,
    realEstateResult,
    stockPortfolioResult,
    stockDividendResult,
    stockSymbolsResult,
    stockStackDividendResult,
    cryptoPortfolioResult,
    cryptoSymbolsResult,
  ] = await Promise.all([
    query(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 2 THEN amount ELSE 0 END), 0)::float AS income,
         COALESCE(SUM(CASE WHEN kind = 1 THEN amount ELSE 0 END), 0)::float AS outcome
       FROM cashflow_transactions
       WHERE user_id = $3
         AND transaction_date >= $1
         AND transaction_date <= $2`,
      [startDate, endDate, userId]
    ),
    query(
      `SELECT
         COALESCE(SUM(COALESCE(capital_cost, 0) * COALESCE(percentage_ownership, 100) / 100), 0)::float AS real_estate_cost,
         COALESCE(SUM(COALESCE(price, 0) * COALESCE(percentage_ownership, 100) / 100), 0)::float AS real_estate_price
       FROM real_estates
       WHERE sold_at IS NULL
         AND user_id = $1`,
      [userId]
    ),
    query(
      `SELECT
         COALESCE(SUM(total_cost_price), 0)::float AS stock_cost,
         COALESCE(SUM(total_price), 0)::float AS stock_price
       FROM stock_portfolios
       WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT COALESCE(SUM(net_dividends_received), 0)::float AS stock_dividend
       FROM stock_dividend_histories
       WHERE dividend_type = 1
         AND user_id = $3
         AND payment_date >= $1
         AND payment_date <= $2`,
      [startDate, endDate, userId]
    ),
    query(
      `SELECT COALESCE(string_agg(stock_code, ',' ORDER BY id), '') AS stock_symbols
       FROM stock_portfolios
       WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT COALESCE(SUM(stock_dividend), 0)::float AS stock_stack_dividend
       FROM monthly_reports
       WHERE user_id = $1
         AND ($2::bigint IS NULL OR id <> $2)`,
      [userId, excludeMonthlyReportId ?? null]
    ),
    query(
      `SELECT
         COALESCE(SUM(total_cost_price), 0)::float AS crypto_cost,
         COALESCE(SUM(total_price), 0)::float AS crypto_price
       FROM crypto_portfolios
       WHERE user_id = $1`,
      [userId]
    ),
    query(
      `SELECT COALESCE(string_agg(crypto_code, ',' ORDER BY id), '') AS crypto_symbols
       FROM crypto_portfolios
       WHERE user_id = $1`,
      [userId]
    ),
  ]);

  const income = Math.abs(toNumber(cashflowResult.rows[0]?.income));
  const outcome = toNumber(cashflowResult.rows[0]?.outcome);
  const realEstateCost = toNumber(
    realEstateResult.rows[0]?.real_estate_cost
  );
  const realEstatePrice = toNumber(
    realEstateResult.rows[0]?.real_estate_price
  );
  const stockCost = toNumber(stockPortfolioResult.rows[0]?.stock_cost);
  const stockPrice = toNumber(stockPortfolioResult.rows[0]?.stock_price);
  const stockDividend = toNumber(
    stockDividendResult.rows[0]?.stock_dividend
  );
  const stockGainLoss = stockPrice - stockCost;
  const stockProfit = stockDividend + stockGainLoss;
  const cryptoCost = toNumber(cryptoPortfolioResult.rows[0]?.crypto_cost);
  const cryptoPrice = toNumber(cryptoPortfolioResult.rows[0]?.crypto_price);
  const cryptoGainLoss = cryptoPrice - cryptoCost;

  return {
    report_date: reportDateString,
    income,
    outcome,
    real_estate_cost: realEstateCost,
    real_estate_monthly_rent: null,
    real_estate_price: realEstatePrice,
    stock_cost: stockCost,
    stock_price: stockPrice,
    stock_dividend: stockDividend,
    stock_gain_loss: stockGainLoss,
    stock_profit: stockProfit,
    stock_profit_rate: calcStockProfitRate(stockProfit, stockCost),
    stock_symbols: String(stockSymbolsResult.rows[0]?.stock_symbols ?? ''),
    stock_stack_dividend:
      toNumber(stockStackDividendResult.rows[0]?.stock_stack_dividend) +
      stockDividend,
    crypto_cost: cryptoCost,
    crypto_price: cryptoPrice,
    crypto_gain_loss: cryptoGainLoss,
    crypto_profit_rate: calcCryptoProfitRate(
      cryptoGainLoss,
      cryptoPrice,
      cryptoCost
    ),
    crypto_symbols: String(cryptoSymbolsResult.rows[0]?.crypto_symbols ?? ''),
  };
}
