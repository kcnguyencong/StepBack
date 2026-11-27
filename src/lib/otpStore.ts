import { executeNeonQuery, ensureNeonTables, getDatabaseUrl } from './neonClient';

// Production OTP storage with Serverless Database persistence & memory fallback
export interface StoredOtpData {
  code: string;
  expiresAt: number;
  fullName: string;
  passwordHash: string;
  otpType?: 'REGISTER' | 'FORGOT_PASSWORD';
}

const memoryOtpStore: Record<string, StoredOtpData> = {};

export async function setStoredOtp(email: string, data: StoredOtpData): Promise<void> {
  const normEmail = email.trim().toLowerCase();
  memoryOtpStore[normEmail] = data;

  if (getDatabaseUrl()) {
    try {
      await ensureNeonTables();
      await executeNeonQuery(
        `INSERT INTO verification_otps (email, code, expires_at, full_name, password_hash, otp_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (email) DO UPDATE SET
           code = EXCLUDED.code,
           expires_at = EXCLUDED.expires_at,
           full_name = EXCLUDED.full_name,
           password_hash = EXCLUDED.password_hash,
           otp_type = EXCLUDED.otp_type,
           attempts = 0,
           created_at = CURRENT_TIMESTAMP;`,
        [normEmail, data.code, data.expiresAt, data.fullName, data.passwordHash, data.otpType || 'REGISTER']
      );
    } catch (e) {
      console.warn('Failed to save OTP to Neon:', e);
    }
  }
}

export async function getStoredOtp(email: string): Promise<StoredOtpData | null> {
  const normEmail = email.trim().toLowerCase();

  if (getDatabaseUrl()) {
    try {
      await ensureNeonTables();
      const res = await executeNeonQuery(
        `SELECT code, expires_at, full_name, password_hash, otp_type
         FROM verification_otps
         WHERE email = $1 LIMIT 1`,
        [normEmail]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          code: row.code,
          expiresAt: Number(row.expires_at),
          fullName: row.full_name,
          passwordHash: row.password_hash,
          otpType: row.otp_type,
        };
      }
    } catch (e) {
      console.warn('Failed to get OTP from Neon:', e);
    }
  }

  return memoryOtpStore[normEmail] || null;
}

export async function clearStoredOtp(email: string): Promise<void> {
  const normEmail = email.trim().toLowerCase();
  delete memoryOtpStore[normEmail];

  if (getDatabaseUrl()) {
    try {
      await executeNeonQuery(`DELETE FROM verification_otps WHERE email = $1`, [normEmail]);
    } catch {}
  }
}
