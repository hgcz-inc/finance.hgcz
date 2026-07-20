import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

function normalizeLimit(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function GET() {
  try {
    const result = await query(
      `SELECT COALESCE(
        (
          SELECT max_spending_limit_per_year_vnd
          FROM application_configs
          ORDER BY id
          LIMIT 1
        ),
        0
      )::float AS max_spending_limit_per_year_vnd`
    );
    const row = result.rows[0];

    return NextResponse.json({
      success: true,
      config: {
        maxSpendingLimitPerYearVnd: normalizeLimit(
          row?.max_spending_limit_per_year_vnd
        ),
      },
    });
  } catch (error) {
    console.error('Error fetching application config:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching application config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const maxSpendingLimitPerYearVnd = Number(
      body.maxSpendingLimitPerYearVnd
    );

    if (
      !Number.isFinite(maxSpendingLimitPerYearVnd) ||
      maxSpendingLimitPerYearVnd < 0
    ) {
      return NextResponse.json(
        { error: 'maxSpendingLimitPerYearVnd must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    const result = await query(
      `WITH updated AS (
        UPDATE application_configs
        SET max_spending_limit_per_year_vnd = $1,
            updated_at = NOW()
        WHERE id = (
          SELECT id
          FROM application_configs
          ORDER BY id
          LIMIT 1
        )
        RETURNING max_spending_limit_per_year_vnd
      ),
      inserted AS (
        INSERT INTO application_configs
          (max_spending_limit_per_year_vnd, is_money_hidden, created_at, updated_at)
        SELECT $1, false, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM updated)
        RETURNING max_spending_limit_per_year_vnd
      )
      SELECT max_spending_limit_per_year_vnd FROM updated
      UNION ALL
      SELECT max_spending_limit_per_year_vnd FROM inserted
      LIMIT 1`,
      [maxSpendingLimitPerYearVnd]
    );
    const row = result.rows[0];

    return NextResponse.json({
      success: true,
      config: {
        maxSpendingLimitPerYearVnd: normalizeLimit(
          row?.max_spending_limit_per_year_vnd
        ),
      },
    });
  } catch (error) {
    console.error('Error saving application config:', error);
    return NextResponse.json(
      { error: 'An error occurred while saving application config' },
      { status: 500 }
    );
  }
}
