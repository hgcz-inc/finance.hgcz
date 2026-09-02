import { NextResponse } from 'next/server';
import { updatePriceStockPortfolios } from '@/lib/updatePriceStockPortfolios';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const result = await updatePriceStockPortfolios(user.id);

    return NextResponse.json({
      success: result.success,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error updating stock portfolio prices:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating stock portfolio prices' },
      { status: 500 }
    );
  }
}
