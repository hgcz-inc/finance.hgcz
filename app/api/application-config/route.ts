import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

function normalizeLimit(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeVisibility(value: unknown): boolean {
  return value === true;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const result = await query(
      `SELECT COALESCE(
        (
          SELECT max_spending_limit_per_year_vnd
          FROM application_configs
          WHERE user_id = $1
          ORDER BY id
          LIMIT 1
        ),
        0
      )::float AS max_spending_limit_per_year_vnd,
      COALESCE(
        (
          SELECT show_max_spending_limit_per_year
          FROM application_configs
          WHERE user_id = $1
          ORDER BY id
          LIMIT 1
        ),
        false
      ) AS show_max_spending_limit_per_year`,
      [user.id]
    );
    const row = result.rows[0];

    return NextResponse.json({
      success: true,
      config: {
        maxSpendingLimitPerYearVnd: normalizeLimit(
          row?.max_spending_limit_per_year_vnd
        ),
        showMaxSpendingLimitPerYear: normalizeVisibility(
          row?.show_max_spending_limit_per_year
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
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const maxSpendingLimitPerYearVnd = Number(
      body.maxSpendingLimitPerYearVnd
    );
    const showMaxSpendingLimitPerYear = body.showMaxSpendingLimitPerYear;

    if (
      !Number.isFinite(maxSpendingLimitPerYearVnd) ||
      maxSpendingLimitPerYearVnd < 0
    ) {
      return NextResponse.json(
        { error: 'maxSpendingLimitPerYearVnd must be greater than or equal to 0' },
        { status: 400 }
      );
    }

    if (typeof showMaxSpendingLimitPerYear !== 'boolean') {
      return NextResponse.json(
        { error: 'showMaxSpendingLimitPerYear must be a boolean' },
        { status: 400 }
      );
    }

    const result = await query(
      `WITH updated AS (
        UPDATE application_configs
        SET max_spending_limit_per_year_vnd = $1,
            show_max_spending_limit_per_year = $3,
            updated_at = NOW()
        WHERE user_id = $2
          AND id = (
          SELECT id
          FROM application_configs
          WHERE user_id = $2
          ORDER BY id
          LIMIT 1
        )
        RETURNING max_spending_limit_per_year_vnd,
                  show_max_spending_limit_per_year
      ),
      inserted AS (
        INSERT INTO application_configs
          (max_spending_limit_per_year_vnd, show_max_spending_limit_per_year,
           is_money_hidden, user_id, created_at, updated_at)
        SELECT $1, $3, false, $2, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM updated)
        RETURNING max_spending_limit_per_year_vnd,
                  show_max_spending_limit_per_year
      )
      SELECT max_spending_limit_per_year_vnd,
             show_max_spending_limit_per_year FROM updated
      UNION ALL
      SELECT max_spending_limit_per_year_vnd,
             show_max_spending_limit_per_year FROM inserted
      LIMIT 1`,
      [maxSpendingLimitPerYearVnd, user.id, showMaxSpendingLimitPerYear]
    );
    const row = result.rows[0];

    return NextResponse.json({
      success: true,
      config: {
        maxSpendingLimitPerYearVnd: normalizeLimit(
          row?.max_spending_limit_per_year_vnd
        ),
        showMaxSpendingLimitPerYear: normalizeVisibility(
          row?.show_max_spending_limit_per_year
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
