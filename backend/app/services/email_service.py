"""
Simple SMTP email service for auth flows.
"""
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib

from ..core.config import settings


def render_auth_email_template(title: str, body: str, action_text: str, action_url: str, expiry_minutes: int) -> str:
    return f"""
    <html>
      <body style=\"font-family: Arial, sans-serif; line-height: 1.5; color: #111;\">
        <h2>{title}</h2>
        <p>{body}</p>
        <p>
          <a href=\"{action_url}\" style=\"display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;\">{action_text}</a>
        </p>
        <p style=\"color:#555;\">This link expires in {expiry_minutes} minutes.</p>
      </body>
    </html>
    """.strip()


def send_auth_email(to_email: str, subject: str, html_body: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        print(f"⚠️ SMTP not configured; skipped email to {to_email}: {subject}")
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.attach(MIMEText(html_body, "html"))

    try:
        if settings.SMTP_USE_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], message.as_string())
        else:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], message.as_string())
        return True
    except Exception as exc:
        print(f"❌ Failed to send auth email to {to_email}: {exc}")
        return False
