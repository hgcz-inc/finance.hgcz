import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    let queryText = `
      SELECT
        ct.*,
        ic.name as category_name,
        ic.id as category_id
      FROM cashflow_transactions ct
      JOIN income_categories ic ON ct.categorizable_id = ic.id
        AND ic.user_id = ct.user_id
      WHERE ct.kind = 2
        AND ct.user_id = $1
        AND ct.categorizable_type = 'IncomeCategory'
    `;

    const params: number[] = [user.id];

    if (year) {
      queryText += ` AND EXTRACT(YEAR FROM ct.transaction_date) = $2`;
      params.push(parseInt(year));
    }

    queryText += ` ORDER BY ct.transaction_date DESC LIMIT 10000`;

    const result = await query(queryText, params);

    return NextResponse.json({
      success: true,
      transactions: result.rows,
    });
  } catch (error) {
    console.error('Error fetching income by category:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching income by category' },
      { status: 500 }
    );
  }
}
