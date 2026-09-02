import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildMonthlyReport } from '@/lib/buildMonthlyReport';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

function toFiniteNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
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

  return {
    startDate: toDateString(new Date(year, month, 1)),
    endDate: toDateString(new Date(year, month + 1, 0)),
  };
}

function parseReportDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date();
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    // Get monthly_reports ordered by report_date descending
    const result = await query(
      `SELECT * FROM monthly_reports
       WHERE user_id = $1
       ORDER BY report_date DESC NULLS LAST, created_at DESC
       LIMIT 100`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      reports: result.rows,
    });
  } catch (error) {
    console.error('Error fetching monthly reports:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching monthly reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const cash = toFiniteNumber(body.cash);
    const debt = toFiniteNumber(body.debt ?? 0);

    if (cash == null || cash < 0) {
      return NextResponse.json(
        { error: 'cash must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    if (debt == null || debt < 0) {
      return NextResponse.json(
        { error: 'debt must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    const reportDate = parseReportDate(body.report_date);
    const { startDate, endDate } = monthRange(reportDate);
    const existingResult = await query(
      `SELECT id
       FROM monthly_reports
       WHERE user_id = $3
         AND report_date >= $1
         AND report_date <= $2
       ORDER BY report_date DESC, id DESC
       LIMIT 1`,
      [startDate, endDate, user.id]
    );
    const existingReportId =
      existingResult.rows[0]?.id == null
        ? undefined
        : Number(existingResult.rows[0].id);
    const calculation = await buildMonthlyReport(
      user.id,
      reportDate,
      existingReportId
    );
    const totalNav =
      cash +
      calculation.stock_price +
      calculation.real_estate_price +
      calculation.crypto_price;

    const params = [
      calculation.report_date,
      calculation.stock_dividend,
      calculation.stock_gain_loss,
      calculation.stock_profit,
      calculation.stock_profit_rate,
      calculation.stock_cost,
      calculation.stock_price,
      calculation.stock_symbols,
      calculation.income,
      calculation.outcome,
      calculation.real_estate_cost,
      calculation.real_estate_price,
      calculation.real_estate_monthly_rent,
      cash,
      totalNav,
      calculation.stock_stack_dividend,
      calculation.crypto_cost,
      calculation.crypto_gain_loss,
      calculation.crypto_price,
      calculation.crypto_profit_rate,
      calculation.crypto_symbols,
      debt,
    ];

    if (existingReportId != null) {
      const result = await query(
        `UPDATE monthly_reports
         SET report_date = $1,
             stock_dividend = $2,
             stock_gain_loss = $3,
             stock_profit = $4,
             stock_profit_rate = $5,
             stock_cost = $6,
             stock_price = $7,
             stock_symbols = $8,
             income = $9,
             outcome = $10,
             real_estate_cost = $11,
             real_estate_price = $12,
             real_estate_monthly_rent = $13,
             cash = $14,
             total_nav = $15,
             stock_stack_dividend = $16,
             crypto_cost = $17,
             crypto_gain_loss = $18,
             crypto_price = $19,
             crypto_profit_rate = $20,
             crypto_symbols = $21,
             debt = $22,
             updated_at = NOW()
         WHERE id = $23
           AND user_id = $24
         RETURNING *`,
        [...params, existingReportId, user.id]
      );

      return NextResponse.json({
        success: true,
        action: 'updated',
        report: result.rows[0],
      });
    }

    const result = await query(
      `INSERT INTO monthly_reports
       (report_date, stock_dividend, stock_gain_loss, stock_profit, stock_profit_rate,
        stock_cost, stock_price, stock_symbols, income, outcome, real_estate_cost,
        real_estate_price, real_estate_monthly_rent, cash, total_nav,
        stock_stack_dividend, crypto_cost, crypto_gain_loss, crypto_price,
        crypto_profit_rate, crypto_symbols, debt, user_id, created_at, updated_at)
       VALUES
       ($1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23, NOW(), NOW())
       RETURNING *`,
      [...params, user.id]
    );

    return NextResponse.json({
      success: true,
      action: 'created',
      report: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating monthly report:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating the monthly report' },
      { status: 500 }
    );
  }
}
