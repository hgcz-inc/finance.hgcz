import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      kind,
      categorizable_type,
      categorizable_id,
      transaction_date,
      note,
    } = body;

    if (
      amount == null ||
      kind == null ||
      !categorizable_type ||
      categorizable_id == null
    ) {
      return NextResponse.json(
        { error: 'amount, kind, categorizable_type, categorizable_id are required' },
        { status: 400 }
      );
    }
    if (kind !== 1 && kind !== 2) {
      return NextResponse.json(
        { error: 'kind must be 1 (outflow) or 2 (inflow)' },
        { status: 400 }
      );
    }
    if (
      categorizable_type !== 'ExpenseCategory' &&
      categorizable_type !== 'IncomeCategory'
    ) {
      return NextResponse.json(
        { error: 'categorizable_type must be ExpenseCategory or IncomeCategory' },
        { status: 400 }
      );
    }

    if (
      !transaction_date ||
      typeof transaction_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)
    ) {
      return NextResponse.json(
        { error: 'transaction_date must be in format YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const dateStr = transaction_date;
    const noteVal = note ?? null;

    await query(
      `INSERT INTO cashflow_transactions
       (amount, kind, categorizable_type, categorizable_id, transaction_date, note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        Number(amount),
        kind,
        categorizable_type,
        Number(categorizable_id),
        dateStr,
        noteVal,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating cashflow transaction:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating the transaction' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json(
        { error: 'year and month are required' },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month' },
        { status: 400 }
      );
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDate = toLocalDateInputValue(today);

    // Summary, yearly spending-to-date, and app config in one query.
    const summaryResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN kind = 2 AND EXTRACT(MONTH FROM transaction_date) = $2 THEN amount ELSE 0 END), 0)::float AS inflow,
        COALESCE(SUM(CASE WHEN kind = 1 AND EXTRACT(MONTH FROM transaction_date) = $2 THEN amount ELSE 0 END), 0)::float AS outflow,
        COALESCE(SUM(CASE WHEN kind = 1 AND transaction_date <= $3::date THEN amount ELSE 0 END), 0)::float AS year_to_date_outflow,
        COALESCE((
          SELECT max_spending_limit_per_year_vnd
          FROM application_configs
          ORDER BY id
          LIMIT 1
        ), 0)::float AS max_spending_limit_per_year_vnd
       FROM cashflow_transactions
       WHERE EXTRACT(YEAR FROM transaction_date) = $1`,
      [yearNum, monthNum, currentDate]
    );
    const row = summaryResult.rows[0];
    const inflow = Number(row?.inflow ?? 0);
    const outflow = Number(row?.outflow ?? 0);
    const yearToDateOutflow = Number(row?.year_to_date_outflow ?? 0);
    const maxSpendingLimitPerYearVnd = Number(
      row?.max_spending_limit_per_year_vnd ?? 0
    );
    const monthlyLimitVnd = maxSpendingLimitPerYearVnd / 12;
    const remainingMonths =
      yearNum > currentYear
        ? 12
        : yearNum === currentYear
          ? 12 - currentMonth + 1
          : 0;
    const remainingYearSpending =
      maxSpendingLimitPerYearVnd - yearToDateOutflow;
    const remainingMonthlySpending =
      remainingMonths > 0 ? remainingYearSpending / remainingMonths : 0;

    // Outflow by category
    const outflowResult = await query(
      `SELECT ec.name AS category_name, ec.id AS category_id, SUM(ct.amount)::float AS total
       FROM cashflow_transactions ct
       JOIN expense_categories ec ON ct.categorizable_id = ec.id AND ct.categorizable_type = 'ExpenseCategory'
       WHERE ct.kind = 1
         AND EXTRACT(YEAR FROM ct.transaction_date) = $1
         AND EXTRACT(MONTH FROM ct.transaction_date) = $2
       GROUP BY ec.id, ec.name
       ORDER BY total DESC`,
      [yearNum, monthNum]
    );

    // Inflow by category
    const inflowResult = await query(
      `SELECT ic.name AS category_name, ic.id AS category_id, SUM(ct.amount)::float AS total
       FROM cashflow_transactions ct
       JOIN income_categories ic ON ct.categorizable_id = ic.id AND ct.categorizable_type = 'IncomeCategory'
       WHERE ct.kind = 2
         AND EXTRACT(YEAR FROM ct.transaction_date) = $1
         AND EXTRACT(MONTH FROM ct.transaction_date) = $2
       GROUP BY ic.id, ic.name
       ORDER BY total DESC`,
      [yearNum, monthNum]
    );

    // All transactions for the month with category name
    const transactionsResult = await query(
      `SELECT ct.id, ct.amount, ct.kind, ct.note,
              TO_CHAR(ct.transaction_date, 'YYYY-MM-DD') AS transaction_date,
              COALESCE(ec.name, ic.name) AS category_name
       FROM cashflow_transactions ct
       LEFT JOIN expense_categories ec ON ct.categorizable_type = 'ExpenseCategory' AND ct.categorizable_id = ec.id
       LEFT JOIN income_categories ic ON ct.categorizable_type = 'IncomeCategory' AND ct.categorizable_id = ic.id
       WHERE EXTRACT(YEAR FROM ct.transaction_date) = $1
         AND EXTRACT(MONTH FROM ct.transaction_date) = $2
       ORDER BY ct.transaction_date DESC, ct.id DESC`,
      [yearNum, monthNum]
    );

    return NextResponse.json({
      success: true,
      summary: {
        inflow,
        outflow,
        netBalance: inflow - outflow,
      },
      spendingLimit: {
        maxSpendingLimitPerYearVnd,
        monthlyLimitVnd,
        yearToDateOutflow,
        remainingYearSpending,
        remainingMonthlySpending,
        remainingMonths,
        currentYear,
        currentMonth,
      },
      outflowByCategory: outflowResult.rows,
      inflowByCategory: inflowResult.rows,
      transactions: transactionsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching cashflow transactions:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching cashflow transactions' },
      { status: 500 }
    );
  }
}
