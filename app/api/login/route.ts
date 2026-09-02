import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { login_id, password } = await request.json();

    if (!login_id || !password) {
      return NextResponse.json(
        { error: 'Login ID and password are required' },
        { status: 400 }
      );
    }

    // Query user from database
    const result = await query(
      'SELECT * FROM users WHERE login_id = $1',
      [login_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid login credentials' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Compare password with encrypted_password
    const isPasswordValid = await bcrypt.compare(
      password,
      user.encrypted_password
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid login credentials' },
        { status: 401 }
      );
    }

    // Update sign in information
    await query(
      `UPDATE users
       SET sign_in_count = sign_in_count + 1,
           last_sign_in_at = current_sign_in_at,
           current_sign_in_at = NOW(),
           last_sign_in_ip = current_sign_in_ip,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        login_id: user.login_id,
        currency: Number(user.currency) === 1 ? 'NZD' : 'VND',
      },
    });
    setSessionCookie(response, Number(user.id));
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
