import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';
import { verifyPassword, hashPassword } from '@/lib/authCrypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, oldPassword, newPassword } = await req.json();

    if (!email || !oldPassword || !newPassword) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ các trường.' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (getDatabaseUrl()) {
      await ensureNeonTables();
      const res = await executeNeonQuery(
        `SELECT id, password_hash, provider FROM users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Không tìm thấy tài khoản.' }, { status: 404 });
      }

      const user = res.rows[0];
      if (user.provider === 'google' && !user.password_hash) {
        return NextResponse.json({
          error: 'Tài khoản đăng nhập qua Google không thể đổi mật khẩu tại đây.',
        }, { status: 400 });
      }

      const isOldMatch = verifyPassword(oldPassword, user.password_hash);
      if (!isOldMatch) {
        return NextResponse.json({ error: 'Mật khẩu hiện tại không chính xác.' }, { status: 401 });
      }

      const newHashed = hashPassword(newPassword);
      await executeNeonQuery(
        `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newHashed, user.id]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
    });
  } catch (err: any) {
    console.error('Change Password API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi đổi mật khẩu.' }, { status: 500 });
  }
}
