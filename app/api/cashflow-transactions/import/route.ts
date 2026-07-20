import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

type ImportAccount = 'joint' | 'individual';

interface ParsedImportRow {
  amount: number;
  categorizableId: number;
  transactionDate: string;
  note: string;
}

const EXPECTED_HEADERS = [
  'Type',
  'Details',
  'Particulars',
  'Code',
  'Reference',
  'Amount',
  'Date',
  'ForeignCurrencyAmount',
  'ConversionCharge',
  'Categorizable',
];

const EXCHANGE_RATE_NZD_TO_VND = 15000;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);

  return rows.filter((csvRow) =>
    csvRow.some((csvField) => csvField.trim() !== '')
  );
}

function validateHeader(headerRow: string[]): string | null {
  const headers = headerRow.map((header) => header.trim());
  const isValid =
    headers.length === EXPECTED_HEADERS.length &&
    EXPECTED_HEADERS.every((expected, index) => headers[index] === expected);

  if (isValid) {
    return null;
  }

  return `CSV header không đúng format. Format cần là: ${EXPECTED_HEADERS.join(',')}`;
}

function parseTransactionDate(value: string): string | null {
  const trimmedValue = value.trim();
  const slashMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return trimmedValue;
    }
  }

  return null;
}

function formatAmountForNote(value: string): string {
  return value.trim().replace(/^[+-]/, '');
}

function buildNote(
  account: ImportAccount,
  details: string,
  code: string,
  amountText: string
): string {
  const prefix = account === 'joint' ? 'Joint' : 'Individual';
  const description = [details.trim(), code.trim()].filter(Boolean).join(' ');

  return `${prefix} | ${description} | ${formatAmountForNote(amountText)} NZD`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const accountValue = formData.get('account');
    const fileValue = formData.get('file');

    if (accountValue !== 'joint' && accountValue !== 'individual') {
      return NextResponse.json(
        { error: 'account must be joint or individual' },
        { status: 400 }
      );
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { error: 'Vui lòng chọn file CSV.' },
        { status: 400 }
      );
    }

    if (!fileValue.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Chỉ cho phép upload file CSV.' },
        { status: 400 }
      );
    }

    const text = await fileValue.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'CSV không có dòng dữ liệu để import.' },
        { status: 400 }
      );
    }

    const headerError = validateHeader(rows[0]);
    if (headerError) {
      return NextResponse.json({ error: headerError }, { status: 400 });
    }

    const categoriesResult = await query(
      'SELECT id, name FROM expense_categories'
    );
    const categoryByName = new Map<string, number>(
      categoriesResult.rows.map((category) => [
        String(category.name).trim().toLowerCase(),
        Number(category.id),
      ])
    );
    const errors: string[] = [];
    const importRows: ParsedImportRow[] = [];

    rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      if (row.length !== EXPECTED_HEADERS.length) {
        errors.push(
          `Dòng ${rowNumber}: số cột không hợp lệ, cần ${EXPECTED_HEADERS.length} cột.`
        );
        return;
      }

      const details = row[1];
      const code = row[3];
      const amountText = row[5].trim();
      const dateText = row[6];
      const categorizableName = row[9].trim();
      const amountNzd = Number(amountText);
      const transactionDate = parseTransactionDate(dateText);
      const categorizableId = categoryByName.get(
        categorizableName.toLowerCase()
      );

      if (!details.trim()) {
        errors.push(`Dòng ${rowNumber}: Details không được để trống.`);
      }

      if (!Number.isFinite(amountNzd) || amountNzd === 0) {
        errors.push(`Dòng ${rowNumber}: Amount không hợp lệ.`);
      }

      if (!transactionDate) {
        errors.push(`Dòng ${rowNumber}: Date không hợp lệ.`);
      }

      if (!categorizableId) {
        errors.push(
          `Dòng ${rowNumber}: Categorizable "${categorizableName}" không tồn tại.`
        );
      }

      if (
        !details.trim() ||
        !Number.isFinite(amountNzd) ||
        amountNzd === 0 ||
        !transactionDate ||
        !categorizableId
      ) {
        return;
      }

      const amountMultiplier = accountValue === 'joint' ? 0.5 : 1;
      importRows.push({
        amount: Math.abs(amountNzd) * EXCHANGE_RATE_NZD_TO_VND * amountMultiplier,
        categorizableId,
        transactionDate,
        note: buildNote(accountValue, details, code, amountText),
      });
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join('\n') },
        { status: 400 }
      );
    }

    if (importRows.length === 0) {
      return NextResponse.json(
        { error: 'CSV không có dòng dữ liệu hợp lệ để import.' },
        { status: 400 }
      );
    }

    const valuesSql = importRows
      .map((_, index) => {
        const base = index * 4;
        return `($${base + 1}, 1, 'ExpenseCategory', $${base + 2}, $${base + 3}, $${base + 4}, NOW(), NOW())`;
      })
      .join(', ');
    const values = importRows.flatMap((row) => [
      row.amount,
      row.categorizableId,
      row.transactionDate,
      row.note,
    ]);

    await query(
      `INSERT INTO cashflow_transactions
       (amount, kind, categorizable_type, categorizable_id, transaction_date, note, created_at, updated_at)
       VALUES ${valuesSql}`,
      values
    );

    return NextResponse.json({
      success: true,
      insertedCount: importRows.length,
    });
  } catch (error) {
    console.error('Error importing cashflow transactions:', error);
    return NextResponse.json(
      { error: 'Có lỗi xảy ra khi import CSV.' },
      { status: 500 }
    );
  }
}
