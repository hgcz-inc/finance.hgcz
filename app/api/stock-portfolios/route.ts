import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

interface StockPortfolioInput {
  stock_code?: unknown;
  shares_number?: unknown;
  cost_price_per_share?: unknown;
  price_per_share?: unknown;
}

type StockPortfolioRow = Record<string, unknown>;

function toFiniteNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function serializeStockPortfolio(row: StockPortfolioRow) {
  return {
    id: Number(row.id),
    stock_code: row.stock_code == null ? null : String(row.stock_code),
    industry_id: toNullableNumber(row.industry_id),
    shares_number: toNullableNumber(row.shares_number),
    cost_price_per_share: toNullableNumber(row.cost_price_per_share),
    price_per_share: toNullableNumber(row.price_per_share),
    total_cost_price: toNullableNumber(row.total_cost_price),
    total_price: toNullableNumber(row.total_price),
    created_at: row.created_at,
    updated_at: row.updated_at,
    gain_loss_value: toNullableNumber(row.gain_loss_value),
    gain_loss_ratio: toNullableNumber(row.gain_loss_ratio),
    capital_structure: toNullableNumber(row.capital_structure),
    portfolio_w: toNullableNumber(row.portfolio_w),
    status:
      row.status === 'profit' || row.status === 'loss'
        ? row.status
        : 'break_even',
  };
}

function serializeTotals(row: StockPortfolioRow | undefined) {
  return {
    total_cost_price: toNullableNumber(row?.total_cost_price),
    total_price: toNullableNumber(row?.total_price),
    gain_loss_value: toNullableNumber(row?.gain_loss_value),
    gain_loss_ratio: toNullableNumber(row?.gain_loss_ratio),
  };
}

function normalizeInput(body: StockPortfolioInput) {
  const stockCode =
    typeof body.stock_code === 'string'
      ? body.stock_code.trim().toUpperCase()
      : '';
  const sharesNumber = toFiniteNumber(body.shares_number);
  const costPricePerShare = toFiniteNumber(body.cost_price_per_share);
  const pricePerShare = toFiniteNumber(body.price_per_share);

  if (!stockCode) {
    return { error: 'stock_code is required' };
  }
  if (sharesNumber == null || sharesNumber <= 0) {
    return { error: 'shares_number must be greater than 0' };
  }
  if (costPricePerShare == null || costPricePerShare < 0) {
    return { error: 'cost_price_per_share must be greater than or equal to 0' };
  }
  if (pricePerShare == null || pricePerShare < 0) {
    return { error: 'price_per_share must be greater than or equal to 0' };
  }

  return {
    value: {
      stockCode,
      sharesNumber,
      costPricePerShare,
      pricePerShare,
      totalCostPrice: costPricePerShare * sharesNumber,
      totalPrice: pricePerShare * sharesNumber,
    },
  };
}

async function fetchStockPortfolios(userId: number) {
  const portfoliosResult = await query(
    `WITH portfolio_totals AS (
       SELECT
         COALESCE(SUM(total_cost_price), 0)::float AS total_cost_price,
         COALESCE(SUM(total_price), 0)::float AS total_price
       FROM stock_portfolios
       WHERE user_id = $1
     )
     SELECT
       sp.id,
       sp.stock_code,
       sp.industry_id,
       sp.shares_number,
       sp.cost_price_per_share,
       sp.price_per_share,
       sp.total_cost_price,
       sp.total_price,
       sp.created_at,
       sp.updated_at,
       (COALESCE(sp.total_price, 0) - COALESCE(sp.total_cost_price, 0))::float AS gain_loss_value,
       CASE
         WHEN COALESCE(sp.total_cost_price, 0) = 0 THEN 0
         ELSE (ABS(COALESCE(sp.total_price, 0) - COALESCE(sp.total_cost_price, 0)) / sp.total_cost_price * 100)::float
       END AS gain_loss_ratio,
       CASE
         WHEN pt.total_cost_price = 0 THEN 0
         ELSE (COALESCE(sp.total_cost_price, 0) / pt.total_cost_price * 100)::float
       END AS capital_structure,
       CASE
         WHEN pt.total_price = 0 THEN 0
         ELSE (COALESCE(sp.total_price, 0) / pt.total_price * 100)::float
       END AS portfolio_w,
       CASE
         WHEN COALESCE(sp.total_price, 0) > COALESCE(sp.total_cost_price, 0) THEN 'profit'
         WHEN COALESCE(sp.total_price, 0) = COALESCE(sp.total_cost_price, 0) THEN 'break_even'
         ELSE 'loss'
       END AS status
     FROM stock_portfolios sp
     CROSS JOIN portfolio_totals pt
     WHERE sp.user_id = $1
     ORDER BY sp.total_price DESC NULLS LAST, sp.stock_code ASC`,
    [userId]
  );

  const totalsResult = await query(
    `SELECT
       COALESCE(SUM(total_cost_price), 0)::float AS total_cost_price,
       COALESCE(SUM(total_price), 0)::float AS total_price,
       (COALESCE(SUM(total_price), 0) - COALESCE(SUM(total_cost_price), 0))::float AS gain_loss_value,
       CASE
         WHEN COALESCE(SUM(total_cost_price), 0) = 0 THEN 0
         ELSE ((COALESCE(SUM(total_price), 0) - COALESCE(SUM(total_cost_price), 0)) / SUM(total_cost_price) * 100)::float
       END AS gain_loss_ratio
     FROM stock_portfolios
     WHERE user_id = $1`,
    [userId]
  );

  return {
    portfolios: portfoliosResult.rows.map(serializeStockPortfolio),
    totals: serializeTotals(totalsResult.rows[0]),
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { portfolios, totals } = await fetchStockPortfolios(user.id);

    return NextResponse.json({
      success: true,
      portfolios,
      totals,
    });
  } catch (error) {
    console.error('Error fetching stock portfolios:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching stock portfolios' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const parsed = normalizeInput(await request.json());
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const {
      stockCode,
      sharesNumber,
      costPricePerShare,
      pricePerShare,
      totalCostPrice,
      totalPrice,
    } = parsed.value;

    const result = await query(
      `INSERT INTO stock_portfolios
       (stock_code, shares_number, cost_price_per_share, price_per_share, total_cost_price, total_price, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        stockCode,
        sharesNumber,
        costPricePerShare,
        pricePerShare,
        totalCostPrice,
        totalPrice,
        user.id,
      ]
    );

    return NextResponse.json({
      success: true,
      portfolio: serializeStockPortfolio(result.rows[0]),
    });
  } catch (error) {
    console.error('Error creating stock portfolio:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating the stock portfolio' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const id = toFiniteNumber(body.id);
    if (id == null) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const parsed = normalizeInput(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const {
      stockCode,
      sharesNumber,
      costPricePerShare,
      pricePerShare,
      totalCostPrice,
      totalPrice,
    } = parsed.value;

    const result = await query(
      `UPDATE stock_portfolios
       SET stock_code = $1,
           shares_number = $2,
           cost_price_per_share = $3,
           price_per_share = $4,
           total_cost_price = $5,
           total_price = $6,
           updated_at = NOW()
       WHERE id = $7
         AND user_id = $8
       RETURNING *`,
      [
        stockCode,
        sharesNumber,
        costPricePerShare,
        pricePerShare,
        totalCostPrice,
        totalPrice,
        id,
        user.id,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Stock portfolio not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      portfolio: serializeStockPortfolio(result.rows[0]),
    });
  } catch (error) {
    console.error('Error updating stock portfolio:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating the stock portfolio' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const id = toFiniteNumber(new URL(request.url).searchParams.get('id'));
    if (id == null) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const result = await query(
      'DELETE FROM stock_portfolios WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Stock portfolio not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stock portfolio:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting the stock portfolio' },
      { status: 500 }
    );
  }
}
