import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';
import { getStoredOtp, clearStoredOtp } from '@/lib/otpStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Thiếu email hoặc mã xác thực.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const stored = await getStoredOtp(normalizedEmail);

    const isMatch = stored && stored.code === otp.trim() && Date.now() < stored.expiresAt;
    // Test fallback only if test environment allows or explicit emergency code
    const isTestFallback = process.env.NODE_ENV !== 'production' && otp.trim() === '123456';

    if (!isMatch && !isTestFallback) {
      return NextResponse.json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' }, { status: 400 });
    }

    const userId = `usr-${Date.now()}`;
    const fullName = stored ? stored.fullName : 'Bệnh nhân';
    const passwordHash = stored ? stored.passwordHash : '';

    // Insert or activate verified user in Neon if configured
    if (getDatabaseUrl()) {
      await ensureNeonTables();
      await executeNeonQuery(
        `INSERT INTO users (id, email, full_name, password_hash, provider, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'email', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (email) DO UPDATE SET
           full_name = COALESCE(NULLIF($3, ''), users.full_name),
           password_hash = CASE WHEN $4 != '' THEN $4 ELSE users.password_hash END,
           is_verified = true,
           updated_at = CURRENT_TIMESTAMP;`,
        [userId, normalizedEmail, fullName, passwordHash]
      );
    }

    await clearStoredOtp(normalizedEmail);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: normalizedEmail,
        fullName,
        provider: 'email',
        isVerified: true,
      },
    });
  } catch (err: any) {
    console.error('Verify OTP API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi xác thực OTP.' }, { status: 500 });
  }
}
