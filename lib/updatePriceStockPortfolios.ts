import { query } from '@/lib/db';

interface StockPortfolioForPriceUpdate {
  id: number;
  stock_code: string | null;
  shares_number: number | null;
}

interface UpdatedStockPortfolio {
  id: number;
  stock_code: string;
  price_per_share: number;
}

export interface UpdatePriceStockPortfoliosResult {
  success: boolean;
  updated: UpdatedStockPortfolio[];
  skipped: string[];
  errors: string[];
}

const SIMPLIZE_PRICE_CLASS = 'css-19r22fg';

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function extractSimplizePrice(html: string): number | null {
  const priceRegex = new RegExp(
    `<([a-z0-9]+)[^>]*class=["'][^"']*${SIMPLIZE_PRICE_CLASS}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i'
  );
  const match = html.match(priceRegex);
  if (!match?.[2]) return null;

  const text = decodeBasicHtmlEntities(match[2].replace(/<[^>]*>/g, ' '))
    .replace(/,/g, '')
    .trim();
  const numericValue = text.match(/-?\d+(?:\.\d+)?/);
  if (!numericValue) return null;

  const price = Number(numericValue[0]);
  return Number.isFinite(price) ? price : null;
}

async function fetchMarketPrice(stockCode: string): Promise<number | null> {
  const response = await fetch(
    `https://simplize.vn/co-phieu/${encodeURIComponent(stockCode)}`,
    {
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; finance.hgcz stock price updater)',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Simplize returned ${response.status} for ${stockCode}`);
  }

  return extractSimplizePrice(await response.text());
}

export async function updatePriceStockPortfolios(): Promise<UpdatePriceStockPortfoliosResult> {
  const result = await query(
    `SELECT id, stock_code, shares_number
     FROM stock_portfolios
     ORDER BY id ASC`
  );
  const portfolios = result.rows as StockPortfolioForPriceUpdate[];
  const updated: UpdatedStockPortfolio[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const portfolio of portfolios) {
    const portfolioId = Number(portfolio.id);
    const stockCode = portfolio.stock_code?.trim().toUpperCase();
    if (!stockCode) {
      skipped.push(`ID ${portfolio.id}: missing stock code`);
      continue;
    }

    try {
      const pricePerShare = await fetchMarketPrice(stockCode);
      if (pricePerShare == null) {
        skipped.push(`${stockCode}: market price not found`);
        continue;
      }

      await query(
        `UPDATE stock_portfolios
         SET price_per_share = $1,
             total_price = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [
          pricePerShare,
          pricePerShare * Number(portfolio.shares_number ?? 0),
          portfolio.id,
        ]
      );

      updated.push({
        id: portfolioId,
        stock_code: stockCode,
        price_per_share: pricePerShare,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${stockCode}: ${message}`);
    }
  }

  return {
    success: errors.length === 0,
    updated,
    skipped,
    errors,
  };
}
