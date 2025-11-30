import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    let queryText = `
      SELECT
        ct.*,
        ec.name as category_name,
        ec.id as category_id
      FROM cashflow_transactions ct
      JOIN expense_categories ec ON ct.categorizable_id = ec.id
      WHERE ct.kind = 1
        AND ct.categorizable_type = 'ExpenseCategory'
    `;

    const params: any[] = [];

    if (year) {
      queryText += ` AND EXTRACT(YEAR FROM ct.transaction_date) = $1`;
      params.push(parseInt(year));
    }

    queryText += ` ORDER BY ct.transaction_date DESC LIMIT 10000`;

    const result = await query(queryText, params);

    return NextResponse.json({
      success: true,
      transactions: result.rows,
    });
  } catch (error) {
    console.error('Error fetching expense by category:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching expense by category' },
      { status: 500 }
    );
  }
}
