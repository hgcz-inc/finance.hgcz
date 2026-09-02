import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const [incomeRes, expenseRes] = await Promise.all([
      query('SELECT id, name FROM income_categories WHERE user_id = $1 ORDER BY id', [user.id]),
      query('SELECT id, name FROM expense_categories WHERE user_id = $1 ORDER BY id', [user.id]),
    ]);
    return NextResponse.json({
      success: true,
      incomeCategories: incomeRes.rows,
      expenseCategories: expenseRes.rows,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching categories' },
      { status: 500 }
    );
  }
}
