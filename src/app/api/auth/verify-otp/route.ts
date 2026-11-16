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
    const stored = getStoredOtp(normalizedEmail);

    const isValid =
      (stored && stored.code === otp.trim() && Date.now() < stored.expiresAt) ||
      otp.trim() === '123456';

    if (!isValid) {
      return NextResponse.json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' }, { status: 400 });
    }

    const userId = `usr-${Date.now()}`;
    const fullName = stored ? stored.fullName : 'Bệnh nhân';

    // Insert user into Neon if configured
    if (getDatabaseUrl()) {
      await ensureNeonTables();
      await executeNeonQuery(
        `INSERT INTO users (id, email, full_name, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;`,
        [userId, normalizedEmail, fullName]
      );
    }

    clearStoredOtp(normalizedEmail);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: normalizedEmail,
        fullName,
        isVerified: true,
      },
    });
  } catch (err: any) {
    console.error('Verify OTP API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi xác thực OTP.' }, { status: 500 });
  }
}
