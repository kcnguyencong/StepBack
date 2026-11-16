import { NextRequest, NextResponse } from 'next/server';
import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from '@/lib/neonClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '451917802570-bfkh9g6ft0k0uhi977s1oujihtquml05.apps.googleusercontent.com';
  return NextResponse.json({ clientId });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email ? body.email.trim().toLowerCase() : 'user@gmail.com';
    const fullName = body.fullName ? body.fullName.trim() : (email.split('@')[0] || 'Bệnh nhân Google');
    const avatarUrl = body.avatarUrl || '/images/knee-hero.png';

    const userId = `usr-g-${Date.now()}`;

    // If Neon is connected, save or update user in database
    if (getDatabaseUrl()) {
      await ensureNeonTables();

      const existing = await executeNeonQuery(
        `SELECT id, email, full_name, avatar_url FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );

      if (existing.rows.length > 0) {
        const u = existing.rows[0];
        return NextResponse.json({
          success: true,
          user: {
            id: u.id,
            email: u.email,
            fullName: u.full_name,
            avatarUrl: u.avatar_url || avatarUrl,
            provider: 'google',
            isVerified: true,
          },
        });
      }

      // Insert new Google user
      await executeNeonQuery(
        `INSERT INTO users (id, email, full_name, provider, avatar_url, is_verified, created_at, updated_at)
         VALUES ($1, $2, $3, 'google', $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [userId, email, fullName, avatarUrl]
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        fullName,
        avatarUrl,
        provider: 'google',
        isVerified: true,
      },
    });
  } catch (err: any) {
    console.error('Google Auth API error:', err);
    return NextResponse.json({ error: 'Lỗi xác thực Google.' }, { status: 500 });
  }
}
