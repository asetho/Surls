import nodemailer from "nodemailer";
import { getEmailTemplate, renderEmailTemplate, type EmailTemplateContent, type EmailTemplateId } from "./email-templates";
import { getSmtpTransportConfig, type SmtpTransportConfig } from "./smtp-settings";

export async function profileEmailAvailable() {
  return Boolean(await getSmtpTransportConfig());
}

function createSmtpTransport(config: SmtpTransportConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: config.username ? { user: config.username, pass: config.password } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    tls: { minVersion: "TLSv1.2" }
  });
}

export async function verifySmtpConnection(config: SmtpTransportConfig) {
  const transport = createSmtpTransport(config);
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}

async function sendEmail(to: string, content: { subject: string; text: string; html: string }) {
  const config = await getSmtpTransportConfig();
  if (!config) throw new Error("SMTP is not configured.");
  const transport = createSmtpTransport(config);
  try {
    await transport.sendMail({
      from: config.fromName ? { name: config.fromName, address: config.from } : config.from,
      to,
      ...content
    });
  } finally {
    transport.close();
  }
}

async function sendTemplate(to: string, id: EmailTemplateId, variables: Record<string, string> = {}) {
  const { content } = await getEmailTemplate(id);
  await sendEmail(to, renderEmailTemplate(id, content, variables));
}

export async function sendProfileEmailCode(to: string, code: string) {
  await sendTemplate(to, "emailChange", { code });
}

export async function sendExternalConnectCode(to: string, code: string) {
  await sendTemplate(to, "providerConnection", { code });
}

export async function sendTotpSetupEmailCode(to: string, code: string) {
  await sendTemplate(to, "authenticatorSetup", { code });
}

export async function sendSmtpTestEmail(to: string) {
  await sendTemplate(to, "smtpTest");
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendTemplate(to, "passwordReset", { resetUrl });
}

export async function sendPasswordChangedEmail(to: string) {
  await sendTemplate(to, "passwordChanged");
}

export async function sendEmailTemplatePreview(to: string, id: EmailTemplateId, draft: EmailTemplateContent) {
  const rendered = renderEmailTemplate(id, draft, {
    code: "000000",
    resetUrl: "https://example.invalid/preview-reset"
  });
  await sendEmail(to, {
    subject: `[Preview] ${rendered.subject}`,
    text: `Preview only — codes and links in this message do not work.\n\n${rendered.text}`,
    html: `<p><strong>Preview only:</strong> codes and links in this message do not work.</p>${rendered.html}`
  });
}
