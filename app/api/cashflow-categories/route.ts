import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [incomeRes, expenseRes] = await Promise.all([
      query('SELECT id, name FROM income_categories ORDER BY id'),
      query('SELECT id, name FROM expense_categories ORDER BY id'),
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
