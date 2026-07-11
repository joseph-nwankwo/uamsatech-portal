import { env } from "@/lib/env";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // No email provider configured — this is expected in local/sandbox
    // development. Log the full content so verification/reset links can
    // still be exercised by hand.
    console.log(
      `[DEV EMAIL FALLBACK] No RESEND_API_KEY set — email not actually sent.\nTo: ${to}\nSubject: ${subject}\n${html}`
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to send email via Resend: ${response.status} ${body}`
    );
  }
}
