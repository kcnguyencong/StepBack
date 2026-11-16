import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';
import { setStoredOtp } from '@/lib/otpStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password } = await req.json();

    if (!fullName || !email || !password) {
      return NextResponse.json({ error: 'Vui lòng cung cấp đầy đủ thông tin.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists in Neon if DB configured
    if (getDatabaseUrl()) {
      await ensureNeonTables();
      const existing = await executeNeonQuery(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'Email này đã được đăng ký tài khoản.' }, { status: 400 });
      }
    }

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    setStoredOtp(normalizedEmail, {
      code: otpCode,
      expiresAt,
      fullName: fullName.trim(),
      passwordHash: password,
    });

    return NextResponse.json({
      success: true,
      message: 'Mã xác thực 6 số đã được gửi tới email.',
      otpCode,
    });
  } catch (err: any) {
    console.error('Register API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi đăng ký.' }, { status: 500 });
  }
}
