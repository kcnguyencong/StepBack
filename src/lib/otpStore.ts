// Shared in-memory OTP storage for authentication
export interface StoredOtpData {
  code: string;
  expiresAt: number;
  fullName: string;
  passwordHash: string;
}

const otpStore: Record<string, StoredOtpData> = {};

export function setStoredOtp(email: string, data: StoredOtpData) {
  otpStore[email.trim().toLowerCase()] = data;
}

export function getStoredOtp(email: string): StoredOtpData | null {
  return otpStore[email.trim().toLowerCase()] || null;
}

export function clearStoredOtp(email: string) {
  delete otpStore[email.trim().toLowerCase()];
}
