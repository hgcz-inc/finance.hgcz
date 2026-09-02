import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

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
    const categoryTable =
      categorizable_type === 'ExpenseCategory'
        ? 'expense_categories'
        : 'income_categories';
    const categoryResult = await query(
      `SELECT id FROM ${categoryTable} WHERE id = $1 AND user_id = $2`,
      [Number(categorizable_id), user.id]
    );
    if (categoryResult.rowCount === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await query(
      `INSERT INTO cashflow_transactions
       (amount, kind, categorizable_type, categorizable_id, transaction_date, note, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        Number(amount),
        kind,
        categorizable_type,
        Number(categorizable_id),
        dateStr,
        noteVal,
        user.id,
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
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

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
          WHERE user_id = $4
          ORDER BY id
          LIMIT 1
        ), 0)::float AS max_spending_limit_per_year_vnd,
        COALESCE((
          SELECT show_max_spending_limit_per_year
          FROM application_configs
          WHERE user_id = $4
          ORDER BY id
          LIMIT 1
        ), false) AS show_max_spending_limit_per_year
       FROM cashflow_transactions
       WHERE user_id = $4
         AND EXTRACT(YEAR FROM transaction_date) = $1`,
      [yearNum, monthNum, currentDate, user.id]
    );
    const row = summaryResult.rows[0];
    const inflow = Number(row?.inflow ?? 0);
    const outflow = Number(row?.outflow ?? 0);
    const yearToDateOutflow = Number(row?.year_to_date_outflow ?? 0);
    const maxSpendingLimitPerYearVnd = Number(
      row?.max_spending_limit_per_year_vnd ?? 0
    );
    const showMaxSpendingLimitPerYear =
      row?.show_max_spending_limit_per_year === true;
    const remainingYearSpending =
      maxSpendingLimitPerYearVnd - yearToDateOutflow;

    // Outflow by category
    const outflowResult = await query(
      `SELECT ec.name AS category_name, ec.id AS category_id, SUM(ct.amount)::float AS total
       FROM cashflow_transactions ct
       JOIN expense_categories ec ON ct.categorizable_id = ec.id
         AND ec.user_id = ct.user_id
         AND ct.categorizable_type = 'ExpenseCategory'
       WHERE ct.kind = 1
         AND ct.user_id = $3
         AND EXTRACT(YEAR FROM ct.transaction_date) = $1
         AND EXTRACT(MONTH FROM ct.transaction_date) = $2
       GROUP BY ec.id, ec.name
       ORDER BY total DESC`,
      [yearNum, monthNum, user.id]
    );

    // Inflow by category
    const inflowResult = await query(
      `SELECT ic.name AS category_name, ic.id AS category_id, SUM(ct.amount)::float AS total
       FROM cashflow_transactions ct
       JOIN income_categories ic ON ct.categorizable_id = ic.id
         AND ic.user_id = ct.user_id
         AND ct.categorizable_type = 'IncomeCategory'
       WHERE ct.kind = 2
         AND ct.user_id = $3
         AND EXTRACT(YEAR FROM ct.transaction_date) = $1
         AND EXTRACT(MONTH FROM ct.transaction_date) = $2
       GROUP BY ic.id, ic.name
       ORDER BY total DESC`,
      [yearNum, monthNum, user.id]
    );

    // All transactions for the month with category name
    const transactionsResult = await query(
      `SELECT ct.id, ct.amount, ct.kind, ct.note,
              TO_CHAR(ct.transaction_date, 'YYYY-MM-DD') AS transaction_date,
              COALESCE(ec.name, ic.name) AS category_name
       FROM cashflow_transactions ct
       LEFT JOIN expense_categories ec ON ct.categorizable_type = 'ExpenseCategory'
         AND ct.categorizable_id = ec.id AND ec.user_id = ct.user_id
       LEFT JOIN income_categories ic ON ct.categorizable_type = 'IncomeCategory'
         AND ct.categorizable_id = ic.id AND ic.user_id = ct.user_id
       WHERE EXTRACT(YEAR FROM ct.transaction_date) = $1
         AND EXTRACT(MONTH FROM ct.transaction_date) = $2
         AND ct.user_id = $3
       ORDER BY ct.transaction_date DESC, ct.id DESC`,
      [yearNum, monthNum, user.id]
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
        showMaxSpendingLimitPerYear,
        yearToDateOutflow,
        remainingYearSpending,
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
