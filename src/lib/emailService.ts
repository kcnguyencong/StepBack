/**
 * AXVYRA Resend Email Service
 * Sends branded medical OTP verification emails for Register & Forgot Password.
 */

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isDomainRestricted?: boolean;
}

export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  fullName: string = 'Bệnh nhân',
  otpType: 'REGISTER' | 'FORGOT_PASSWORD' = 'REGISTER'
): Promise<SendOtpResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured in environment');
    return { success: false, error: 'Chưa cấu hình biến môi trường RESEND_API_KEY.' };
  }

  const isReset = otpType === 'FORGOT_PASSWORD';
  const emailSubject = isReset
    ? `Mã đặt lại mật khẩu AXVYRA: ${otpCode}`
    : `Mã xác thực đăng ký AXVYRA: ${otpCode}`;

  const greetingDesc = isReset
    ? 'Bạn đang yêu cầu <strong>đặt lại mật khẩu</strong> cho tài khoản của mình trên hệ thống <strong>AXVYRA</strong>. Vui lòng sử dụng mã xác thực dưới đây để hoàn tất:'
    : 'Bạn đang đăng ký tài khoản phục hồi chức năng dây chằng và sụn chêm trên <strong>AXVYRA</strong>. Vui lòng sử dụng mã xác thực dưới đây để hoàn tất:';

  const boxLabel = isReset
    ? 'Mã đặt lại mật khẩu (hiệu lực 10 phút)'
    : 'Mã xác thực đăng ký (hiệu lực 10 phút)';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${emailSubject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0C0D11; margin: 0; padding: 24px; color: #E2E8F0; }
        .card { max-width: 480px; margin: 0 auto; background: #16181F; border-radius: 28px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .header { background: linear-gradient(135deg, #0C0D11 0%, #16181F 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .logo-title { color: #FFFFFF; font-size: 22px; font-weight: 700; letter-spacing: 3px; margin: 0; }
        .logo-sub { color: #34D399; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 17px; font-weight: 600; color: #FFFFFF; margin-bottom: 10px; }
        .desc { font-size: 14px; line-height: 1.6; color: #94A3B8; margin-bottom: 24px; }
        .otp-box { background: rgba(52, 211, 153, 0.08); border: 2px dashed rgba(52, 211, 153, 0.4); border-radius: 20px; padding: 22px; text-align: center; margin-bottom: 24px; }
        .otp-label { font-size: 11px; font-weight: 600; color: #34D399; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #FFFFFF; font-family: 'Courier New', monospace; margin: 0; }
        .notice { font-size: 12px; color: #64748B; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 18px; }
        .footer { background: rgba(0,0,0,0.2); padding: 18px 24px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid rgba(255,255,255,0.06); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo-title">AXVYRA</div>
          <div class="logo-sub">Rebuild. Rise. Return.</div>
        </div>
        <div class="content">
          <div class="greeting">Xin chào ${fullName},</div>
          <div class="desc">
            ${greetingDesc}
          </div>
          <div class="otp-box">
            <div class="otp-label">${boxLabel}</div>
            <div class="otp-code">${otpCode}</div>
          </div>
          <div class="notice">
            ⚠️ <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai. Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email và tài khoản của bạn vẫn an toàn.
          </div>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} AXVYRA Medical Rehabilitation. Chuẩn y khoa chuyên sâu phục hồi ACL & Sụn chêm.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AXVYRA Medical <onboarding@resend.dev>',
        to: [toEmail],
        subject: emailSubject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.warn('Resend send email error response:', data);
      const isDomainRestricted =
        data?.message?.includes('testing emails to your own email address') ||
        data?.statusCode === 403;

      return {
        success: false,
        error: data?.message || 'Không thể gửi email qua Resend',
        isDomainRestricted,
      };
    }

    return {
      success: true,
      messageId: data.id,
    };
  } catch (err: any) {
    console.error('sendOtpEmail exception:', err);
    return {
      success: false,
      error: err.message || 'Lỗi mạng khi kết nối tới dịch vụ email Resend',
    };
  }
}
