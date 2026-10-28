import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

if (!apiKey) {
  throw new Error("RESEND_API_KEY is not configured");
}

if (!emailFrom) {
  throw new Error("EMAIL_FROM is not configured");
}

const resend = new Resend(apiKey);

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: emailFrom,
    to: email,
    subject: "Reset your Chat With PDF password",
    text: [
      "We received a request to reset your password.",
      "",
      `Reset your password using this link: ${resetUrl}`,
      "",
      "This link expires in 30 minutes and can only be used once.",
      "If you did not request a password reset, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset your password</h2>
        <p>
          We received a request to reset your Chat With PDF password.
        </p>
        <p>
          <a href="${resetUrl}">Reset your password</a>
        </p>
        <p>
          This link expires in 30 minutes and can only be used once.
        </p>
        <p>
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend email delivery request failed: ${error.message}`);
  }
}
