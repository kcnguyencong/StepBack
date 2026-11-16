/**
 * AXVYRA Resend Email Service
 * Sends branded medical OTP verification emails.
 */

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isDomainRestricted?: boolean;
}

export async function sendOtpEmail(toEmail: string, otpCode: string, fullName: string = 'Bệnh nhân'): Promise<SendOtpResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured in environment');
    return { success: false, error: 'Chưa cấu hình biến môi trường RESEND_API_KEY.' };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mã xác thực AXVYRA</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
        .card { max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 24px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 32px 24px; text-align: center; }
        .logo-title { color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: 2px; margin: 0; }
        .logo-sub { color: #84CC16; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
        .desc { font-size: 14px; line-height: 1.6; color: #64748B; margin-bottom: 24px; }
        .otp-box { background: #F0FDF4; border: 2px dashed #86EFAC; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .otp-label { font-size: 11px; font-weight: 700; color: #15803D; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
        .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #166534; font-family: 'Courier New', monospace; margin: 0; }
        .notice { font-size: 12px; color: #94A3B8; line-height: 1.5; border-top: 1px solid #F1F5F9; padding-top: 16px; }
        .footer { background: #F8FAFC; padding: 18px 24px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
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
            Bạn đang đăng ký tài khoản phục hồi chức năng dây chằng và sụn chêm trên <strong>AXVYRA</strong>. Vui lòng sử dụng mã xác thực dưới đây để hoàn tất:
          </div>
          <div class="otp-box">
            <div class="otp-label">Mã xác thực của bạn (hiệu lực 10 phút)</div>
            <div class="otp-code">${otpCode}</div>
          </div>
          <div class="notice">
            ⚠️ <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
          </div>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} AXVYRA Medical Rehab. Nền tảng phục hồi vận động chuẩn y khoa.
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
        from: 'AXVYRA <onboarding@resend.dev>',
        to: [toEmail],
        subject: `Mã xác thực AXVYRA: ${otpCode}`,
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
    console.error('Failed to call Resend API:', err);
    return {
      success: false,
      error: err.message || 'Lỗi kết nối dịch vụ gửi email',
    };
  }
}
