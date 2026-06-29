import { NextResponse } from 'next/server';
import { updatePriceStockPortfolios } from '@/lib/updatePriceStockPortfolios';

export async function POST() {
  try {
    const result = await updatePriceStockPortfolios();

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
