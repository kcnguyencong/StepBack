import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';
import { setStoredOtp } from '@/lib/otpStore';
import { sendOtpEmail } from '@/lib/emailService';

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
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    setStoredOtp(normalizedEmail, {
      code: otpCode,
      expiresAt,
      fullName: fullName.trim(),
      passwordHash: password,
    });

    // Send real email via Resend
    const emailResult = await sendOtpEmail(normalizedEmail, otpCode, fullName.trim());

    if (!emailResult.success) {
      console.warn('Email sending notice:', emailResult.error);
      if (emailResult.isDomainRestricted) {
        // Resend free sandbox only allows sending to the account owner email
        return NextResponse.json({
          success: true,
          message: 'Tài khoản Resend thử nghiệm chỉ cho phép gửi tới email đăng ký của bạn. Mã OTP tạm thời:',
          otpCode, // Fallback for unverified test emails only
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Mã xác thực 6 số đã được gửi tới email của bạn. Vui lòng kiểm tra hòm thư (kể cả thư mục Spam)!',
    });
  } catch (err: any) {
    console.error('Register API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi đăng ký.' }, { status: 500 });
  }
}
