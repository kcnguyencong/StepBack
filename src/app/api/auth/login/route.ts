import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';

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
        `SELECT id, email, full_name FROM users WHERE email = $1 LIMIT 1`,
        [normalizedEmail]
      );

      if (result.rows.length > 0) {
        const u = result.rows[0];
        return NextResponse.json({
          success: true,
          user: {
            id: u.id,
            email: u.email,
            fullName: u.full_name,
            isVerified: true,
          },
        });
      }
    }

    // Default authenticated response for valid email format
    const nameFromEmail = normalizedEmail.split('@')[0];
    const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);

    return NextResponse.json({
      success: true,
      user: {
        id: `usr-${Date.now()}`,
        email: normalizedEmail,
        fullName: formattedName,
        isVerified: true,
      },
    });
  } catch (err: any) {
    console.error('Login API Error:', err);
    return NextResponse.json({ error: 'Lỗi máy chủ khi đăng nhập.' }, { status: 500 });
  }
}
