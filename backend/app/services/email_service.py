import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, body_html: str) -> None:
    """Send an email using configured SMTP settings."""
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(f"SMTP configuration is missing. Cannot send email to {to_email}")
        logger.warning(f"Email content would be:\nSubject: {subject}\nBody: {body_html}")
        return

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email

    # Attach the HTML body
    part = MIMEText(body_html, "html")
    msg.attach(part)

    try:
        logger.info(f"Connecting to SMTP server {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_email, to_email, msg.as_string())
        logger.info(f"Email successfully sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")


def send_password_reset_email(to_email: str, token: str) -> None:
    """Construct and send a password reset email."""
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    
    # for development write link to terminal just in case email doesn't work lol
    print("\n" + "="*50)
    print("----- PASSWORD RESET LINK GENERATED -----")
    print(f"To: {to_email}")
    print(f"Link: {reset_url}")
    print("="*50 + "\n")

    subject = "Reset Password"
    body_html = f"""
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #374151; margin: 0; padding: 0;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px;">
                    <!-- Logo -->
                    <div style="margin-bottom: 32px;">
                      <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.02em;">TAURON</h1>
                    </div>

                    <!-- Greeting & Intro -->
                    <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.02em;">Reset your password</h2>
                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #4b5563;">
                      We received a request to reset the password for your Tauron account. Click the button below to choose a new one.
                    </p>

                    <!-- CTA Button -->
                    <div style="margin-bottom: 32px;">
                      <a href="{reset_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-size: 16px; font-weight: 500; text-decoration: none; border-radius: 8px;">
                        Reset password
                      </a>
                    </div>

                    <!-- Security Note -->
                    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #6b7280;">
                      If you didn't mean to reset your password, you can safely ignore this email. Your password will not change until you access the link above and create a new one.
                    </p>

                    <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 32px 0;">

                    <!-- Direct Link fallback -->
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">
                      Trouble with the button?
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #2563eb; word-break: break-all; font-family: monospace;">
                      {reset_url}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; margin-top: 24px;">
                <tr>
                  <td align="center" style="padding: 0 20px;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                      &copy; 2026 Tauron AI. All rights reserved.<br>
                      This is an automated security notification.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """
    
    send_email(to_email, subject, body_html)
