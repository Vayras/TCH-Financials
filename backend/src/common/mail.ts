import { Resend } from 'resend';
import { env } from '../env';

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!env.resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }
  if (!resendClient) {
    resendClient = new Resend(env.resendApiKey);
  }
  return resendClient;
}

export async function sendInviteEmail(opts: { to: string; inviteUrl: string }): Promise<void> {
  const { to, inviteUrl } = opts;
  const { error } = await getResend().emails.send({
    from: env.resendFromEmail,
    to: [to],
    subject: "You're invited to TCH Financials",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">Welcome to TCH Financials</h1>
        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px;">
          You've been invited to TCH Financials. Click the button below to accept your invitation and set a password.
        </p>
        <a href="${inviteUrl}"
           style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
          Accept invitation
        </a>
        <p style="font-size: 13px; line-height: 1.5; color: #666; margin: 24px 0 0;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${inviteUrl}" style="color: #666; word-break: break-all;">${inviteUrl}</a>
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}
