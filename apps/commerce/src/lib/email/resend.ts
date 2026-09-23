import { Resend } from "resend";

export function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export function getEmailFrom() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Prospect Ads <vendas@prospectads.com.br>"
  );
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  tags?: { name: string; value: string }[];
}) {
  const resend = getResend();
  if (!resend) {
    console.log("[email:mock]", input.to, input.subject);
    return { mocked: true as const };
  }

  const result = await resend.emails.send({
    from: getEmailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    tags: input.tags,
  });

  if (result.error) {
    console.error("[email:resend]", result.error);
    throw new Error(result.error.message || "Falha ao enviar e-mail");
  }

  return result;
}
