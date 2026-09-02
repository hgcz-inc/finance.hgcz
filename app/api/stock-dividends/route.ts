import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    // Get stock dividend histories with dividend_type = 1 (cash dividend)
    const result = await query(
      `SELECT * FROM stock_dividend_histories
       WHERE dividend_type = 1
         AND user_id = $1
       ORDER BY payment_date DESC, ex_dividend_date DESC
       LIMIT 1000`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      dividends: result.rows,
    });
  } catch (error) {
    console.error('Error fetching stock dividends:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching stock dividends' },
      { status: 500 }
    );
  }
}
