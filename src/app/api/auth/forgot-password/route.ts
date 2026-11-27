import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';
import { setStoredOtp } from '@/lib/otpStore';
import { sendOtpEmail } from '@/lib/emailService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Vui lòng cung cấp địa chỉ email.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check user in Neon if configured
    let userFullName = 'Bệnh nhân';
    if (getDatabaseUrl()) {
      await ensureNeonTables();
      const res = await executeNeonQuery(
        `SELECT full_name, provider FROM users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Không tìm thấy tài khoản với email này.' }, { status: 404 });
      }

      if (res.rows[0].provider === 'google') {
        return NextResponse.json({
          error: 'Tài khoản này đăng nhập bằng Google. Vui lòng chọn "Đăng nhập bằng Google".',
        }, { status: 400 });
      }

      userFullName = res.rows[0].full_name || 'Bệnh nhân';
    }

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save to Database OTP table with memory fallback
    await setStoredOtp(normalizedEmail, {
      code: otpCode,
      expiresAt,
      fullName: userFullName,
      passwordHash: '',
      otpType: 'FORGOT_PASSWORD',
    });

    // Send email via Resend
    const emailResult = await sendOtpEmail(normalizedEmail, otpCode, userFullName, 'FORGOT_PASSWORD');

    if (!emailResult.success) {
      console.warn('Forgot password email notice:', emailResult.error);
      if (emailResult.isDomainRestricted) {
        return NextResponse.json({
          success: true,
          message: 'Tài khoản Resend thử nghiệm giới hạn gửi email. Mã OTP của bạn:',
          otpCode,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Mã xác thực 6 số đã được gửi tới email của bạn. Vui lòng kiểm tra hòm thư!',
    });
  } catch (err: any) {
    console.error('Forgot Password API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi yêu cầu đặt lại mật khẩu.' }, { status: 500 });
  }
}
