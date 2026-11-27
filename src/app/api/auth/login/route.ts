import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';
import { verifyPassword, hashPassword } from '@/lib/authCrypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng cung cấp email và mật khẩu.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check user in Neon if configured
    if (getDatabaseUrl()) {
      await ensureNeonTables();
      const result = await executeNeonQuery(
        `SELECT id, email, full_name, password_hash, provider, is_verified, avatar_url
         FROM users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );

      if (result.rows.length > 0) {
        const u = result.rows[0];

        // If user registered with Google provider and has no password
        if (u.provider === 'google' && !u.password_hash) {
          return NextResponse.json({
            error: 'Tài khoản này được đăng ký qua Google. Vui lòng bấm "Đăng nhập bằng Google".',
          }, { status: 400 });
        }

        // Verify password
        const isMatch = verifyPassword(password, u.password_hash);
        if (!isMatch) {
          return NextResponse.json({ error: 'Email hoặc mật khẩu không chính xác.' }, { status: 401 });
        }

        // Seamless auto-migration: If password was stored plaintext, upgrade to hashed
        if (u.password_hash && !u.password_hash.includes(':')) {
          const newHashed = hashPassword(password);
          await executeNeonQuery(
            `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [newHashed, u.id]
          );
        }

        return NextResponse.json({
          success: true,
          user: {
            id: u.id,
            email: u.email,
            fullName: u.full_name,
            avatarUrl: u.avatar_url,
            provider: u.provider || 'email',
            isVerified: Boolean(u.is_verified),
          },
        });
      } else {
        return NextResponse.json({ error: 'Tài khoản không tồn tại. Vui lòng đăng ký.' }, { status: 404 });
      }
    }

    // Local development fallback if no DATABASE_URL
    const nameFromEmail = normalizedEmail.split('@')[0];
    const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);

    return NextResponse.json({
      success: true,
      user: {
        id: `usr-${Date.now()}`,
        email: normalizedEmail,
        fullName: formattedName,
        provider: 'email',
        isVerified: true,
      },
    });
  } catch (err: any) {
    console.error('Login API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi đăng nhập.' }, { status: 500 });
  }
}
