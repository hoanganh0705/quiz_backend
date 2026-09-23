import { escapeHtml, escapeHtmlAttr, formatTtlDescription } from './escape';

export interface VerificationEmailTemplateInput {
  readonly fromName: string;
  readonly verificationUrl: string;
  readonly ttlSeconds: number;
}

export const renderVerificationEmail = ({
  fromName,
  verificationUrl,
  ttlSeconds,
}: VerificationEmailTemplateInput): { readonly subject: string; readonly html: string } => {
  const safeFromName = escapeHtml(fromName);
  const safeUrl = escapeHtmlAttr(verificationUrl);
  const ttlDescription = formatTtlDescription(ttlSeconds);
  const year = new Date().getUTCFullYear();

  return {
    subject: 'Verify your email',
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify Your Email — ${safeFromName}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <span style="font-size:22px;font-weight:700;color:#1a1a2e;letter-spacing:-0.5px;">${safeFromName}</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;border-radius:12px;padding:40px 48px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <p style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#1a1a2e;line-height:1.3;">
                  Verify your email address
                </p>
                <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;line-height:1.6;">
                  Thanks for signing up! Click the button below to confirm your email address and activate your account.
                  This link expires in <strong>${escapeHtml(ttlDescription)}</strong>.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding-bottom:28px;">
                      <a href="${safeUrl}"
                         style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;
                                text-decoration:none;border-radius:8px;padding:14px 36px;letter-spacing:0.2px;">
                        Verify Email Address
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 6px 0;font-size:13px;color:#9ca3af;line-height:1.5;">
                  Button not working? Copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 28px 0;word-break:break-all;">
                  <a href="${safeUrl}" style="font-size:13px;color:#4f46e5;text-decoration:underline;">${safeUrl}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px 0;" />
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                  If you didn't create an account, you can safely ignore this email — no action is needed.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:24px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  &copy; ${year} ${safeFromName}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
};
