import tls from 'tls';

/**
 * AXVYRA Hybrid Email Service:
 * 1. Primary: Native Gmail SMTP (over TLS 465) - Sends to ANY email with 0 domain verification.
 * 2. Fallback: Resend API.
 */

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isDomainRestricted?: boolean;
  provider?: 'gmail_smtp' | 'resend';
}

/**
 * Native Zero-Dependency Gmail SMTP Client (Port 465 SSL/TLS)
 */
async function sendViaGmailSmtp(
  user: string,
  appPassword: string,
  toEmail: string,
  subject: string,
  htmlContent: string
): Promise<SendOtpResult> {
  return new Promise((resolve) => {
    const cleanPass = appPassword.replace(/\s+/g, '');
    const cleanUser = user.trim();

    const socket = tls.connect(465, 'smtp.gmail.com', { rejectUnauthorized: true }, () => {
      // TLS connection established
    });

    socket.setEncoding('utf-8');
    let step = 0;

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({
        success: false,
        error: 'Kết nối tới máy chủ Gmail SMTP bị quá hạn (10s).',
        provider: 'gmail_smtp',
      });
    }, 10000);

    socket.on('data', (raw: string) => {
      const code = parseInt(raw.substring(0, 3), 10);

      try {
        if (step === 0 && code === 220) {
          step = 1;
          socket.write('EHLO localhost\r\n');
        } else if (step === 1 && code === 250) {
          // Multiline 250 response ends with "250 " or last line
          if (raw.includes('250 ') || raw.startsWith('250 ')) {
            step = 2;
            socket.write('AUTH LOGIN\r\n');
          }
        } else if (step === 2 && code === 334) {
          step = 3;
          socket.write(Buffer.from(cleanUser).toString('base64') + '\r\n');
        } else if (step === 3 && code === 334) {
          step = 4;
          socket.write(Buffer.from(cleanPass).toString('base64') + '\r\n');
        } else if (step === 4 && code === 235) {
          step = 5;
          socket.write(`MAIL FROM:<${cleanUser}>\r\n`);
        } else if (step === 5 && code === 250) {
          step = 6;
          socket.write(`RCPT TO:<${toEmail.trim()}>\r\n`);
        } else if (step === 6 && code === 250) {
          step = 7;
          socket.write('DATA\r\n');
        } else if (step === 7 && code === 354) {
          step = 8;
          const mime = [
            `From: "AXVYRA Medical" <${cleanUser}>`,
            `To: <${toEmail.trim()}>`,
            `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            Buffer.from(htmlContent).toString('base64'),
            '',
            '.',
            '',
          ].join('\r\n');
          socket.write(mime);
        } else if (step === 8 && code === 250) {
          step = 9;
          socket.write('QUIT\r\n');
          clearTimeout(timeout);
          socket.end();
          resolve({
            success: true,
            provider: 'gmail_smtp',
          });
        } else if (code >= 400) {
          clearTimeout(timeout);
          socket.destroy();
          const cleanErr = raw.replace(/\r?\n/g, ' ').trim();
          resolve({
            success: false,
            error: `Lỗi xác thực Gmail SMTP (${code}): ${cleanErr}`,
            provider: 'gmail_smtp',
          });
        }
      } catch (err: any) {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          success: false,
          error: err.message || 'Lỗi gửi gói tin SMTP',
          provider: 'gmail_smtp',
        });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        error: `Không thể kết nối smtp.gmail.com: ${err.message}`,
        provider: 'gmail_smtp',
      });
    });
  });
}

export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  fullName: string = 'Bệnh nhân',
  otpType: 'REGISTER' | 'FORGOT_PASSWORD' = 'REGISTER'
): Promise<SendOtpResult> {
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

  // 1. Check if Gmail SMTP credentials are provided
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.GMAIL_PASSWORD;

  if (gmailUser && gmailPass) {
    const smtpResult = await sendViaGmailSmtp(gmailUser, gmailPass, toEmail, emailSubject, htmlContent);
    if (smtpResult.success) {
      return smtpResult;
    }
    console.warn('Gmail SMTP attempt failed, falling back to Resend if available:', smtpResult.error);
  }

  // 2. Resend API Fallback
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'Chưa cấu hình GMAIL_USER/GMAIL_APP_PASSWORD hoặc RESEND_API_KEY.',
    };
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'AXVYRA Medical <onboarding@resend.dev>';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
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
        provider: 'resend',
      };
    }

    return {
      success: true,
      messageId: data.id,
      provider: 'resend',
    };
  } catch (err: any) {
    console.error('sendOtpEmail exception:', err);
    return {
      success: false,
      error: err.message || 'Lỗi mạng khi kết nối tới dịch vụ email Resend',
      provider: 'resend',
    };
  }
}
