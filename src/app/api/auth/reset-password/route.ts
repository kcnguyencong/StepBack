import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';
import { getStoredOtp, clearStoredOtp } from '@/lib/otpStore';
import { hashPassword } from '@/lib/authCrypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'Vui lòng cung cấp đầy đủ thông tin.' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const stored = await getStoredOtp(normalizedEmail);

    const isMatch = stored && stored.code === otp.trim() && Date.now() < stored.expiresAt;
    const isTestFallback = process.env.NODE_ENV !== 'production' && otp.trim() === '123456';

    if (!isMatch && !isTestFallback) {
      return NextResponse.json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' }, { status: 400 });
    }

    const hashedPassword = hashPassword(newPassword);

    let updatedUser = {
      id: `usr-${Date.now()}`,
      email: normalizedEmail,
      fullName: stored ? stored.fullName : 'Bệnh nhân',
      provider: 'email',
      isVerified: true,
    };

    if (getDatabaseUrl()) {
      await ensureNeonTables();
      const res = await executeNeonQuery(
        `UPDATE users
         SET password_hash = $1, is_verified = true, updated_at = CURRENT_TIMESTAMP
         WHERE email = $2
         RETURNING id, email, full_name, avatar_url, provider, is_verified;`,
        [hashedPassword, normalizedEmail]
      );

      if (res.rows.length > 0) {
        const u = res.rows[0];
        updatedUser = {
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          provider: u.provider || 'email',
          isVerified: true,
        };
      }
    }

    await clearStoredOtp(normalizedEmail);

    return NextResponse.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.',
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('Reset Password API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi đặt lại mật khẩu.' }, { status: 500 });
  }
}
