import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get monthly_reports ordered by report_date descending
    const result = await query(
      `SELECT * FROM monthly_reports
       ORDER BY report_date DESC NULLS LAST, created_at DESC
       LIMIT 100`,
      []
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
