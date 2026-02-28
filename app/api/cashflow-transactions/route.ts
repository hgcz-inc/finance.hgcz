import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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

    // Summary: inflow (kind=2), outflow (kind=1)
    const summaryResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN kind = 2 THEN amount ELSE 0 END), 0)::float AS inflow,
        COALESCE(SUM(CASE WHEN kind = 1 THEN amount ELSE 0 END), 0)::float AS outflow
       FROM cashflow_transactions
       WHERE EXTRACT(YEAR FROM transaction_date) = $1
         AND EXTRACT(MONTH FROM transaction_date) = $2`,
      [yearNum, monthNum]
    );
    const row = summaryResult.rows[0];
    const inflow = Number(row?.inflow ?? 0);
    const outflow = Number(row?.outflow ?? 0);

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
      `SELECT ct.id, ct.amount, ct.kind, ct.note, ct.transaction_date,
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
