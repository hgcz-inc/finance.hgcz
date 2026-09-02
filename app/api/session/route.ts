import { NextResponse } from 'next/server';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  return NextResponse.json({
    success: true,
    user: { id: user.id, login_id: user.loginId },
  });
}
