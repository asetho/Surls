import { prisma } from "./prisma";

export type EmailTemplateContent = { subject: string; text: string; html: string };

export const EMAIL_TEMPLATES = {
  emailChange: {
    label: "Email change verification",
    description: "Sent to the current address when a user verifies an email change.",
    required: ["code"],
    defaults: {
      subject: "Surls email change verification code",
      text: "Your Surls email change verification code is {{code}}. It expires in 10 minutes. If you did not request this change, you can ignore this email.",
      html: "<p>Your Surls email change verification code is <strong>{{code}}</strong>.</p><p>It expires in 10 minutes. If you did not request this change, you can ignore this email.</p>"
    }
  },
  providerConnection: {
    label: "Sign-in provider connection",
    description: "Sent when a user verifies a new sign-in provider by email.",
    required: ["code"],
    defaults: {
      subject: "Surls sign-in provider connection verification code",
      text: "Your Surls sign-in provider connection verification code is {{code}}. It expires in 10 minutes. If you did not request this connection, you can ignore this email.",
      html: "<p>Your Surls sign-in provider connection verification code is <strong>{{code}}</strong>.</p><p>It expires in 10 minutes. If you did not request this connection, you can ignore this email.</p>"
    }
  },
  authenticatorSetup: {
    label: "Authenticator setup verification",
    description: "Sent when a user chooses email verification during authenticator setup.",
    required: ["code"],
    defaults: {
      subject: "Surls authenticator setup verification code",
      text: "Your Surls authenticator setup verification code is {{code}}. It expires in 10 minutes. If you did not request this, you can ignore this email.",
      html: "<p>Your Surls authenticator setup verification code is <strong>{{code}}</strong>.</p><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>"
    }
  },
  passwordReset: {
    label: "Password reset",
    description: "Sent when an eligible user requests a password reset.",
    required: ["resetUrl"],
    defaults: {
      subject: "Reset your Surls password",
      text: "A password reset was requested for your Surls account. Open this link within 15 minutes:\n\n{{resetUrl}}\n\nIf you did not request this, ignore this email. Your password has not changed.",
      html: "<p>A password reset was requested for your Surls account. <a href=\"{{resetUrl}}\">Reset your password</a> within 15 minutes.</p><p>If you did not request this, ignore this email. Your password has not changed.</p>"
    }
  },
  passwordChanged: {
    label: "Password changed",
    description: "Sent after a password reset succeeds.",
    required: [],
    defaults: {
      subject: "Your Surls password was changed",
      text: "Your Surls password was changed and existing sessions were signed out. If you did not make this change, contact your site administrator immediately.",
      html: "<p>Your Surls password was changed and existing sessions were signed out.</p><p>If you did not make this change, contact your site administrator immediately.</p>"
    }
  },
  smtpTest: {
    label: "SMTP test",
    description: "Sent when a site admin tests email delivery.",
    required: [],
    defaults: {
      subject: "Surls SMTP test",
      text: "Your Surls email settings are working.",
      html: "<p>Your Surls email settings are working.</p>"
    }
  }
} as const;

export type EmailTemplateId = keyof typeof EMAIL_TEMPLATES;
export const EMAIL_TEMPLATE_IDS = Object.keys(EMAIL_TEMPLATES) as EmailTemplateId[];
const PLACEHOLDER = /{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g;

export class EmailTemplateError extends Error {}

export function emailTemplateId(value: unknown): EmailTemplateId {
  if (typeof value === "string" && Object.hasOwn(EMAIL_TEMPLATES, value)) return value as EmailTemplateId;
  throw new EmailTemplateError("Choose a valid email template.");
}

export function validateEmailTemplate(id: EmailTemplateId, value: unknown): EmailTemplateContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new EmailTemplateError("Enter the email template fields.");
  const record = value as Record<string, unknown>;
  const limits = { subject: 200, text: 12000, html: 24000 } as const;
  const content = {} as EmailTemplateContent;
  for (const key of ["subject", "text", "html"] as const) {
    const field = record[key];
    if (typeof field !== "string" || !field.trim() || field.length > limits[key] || /\0/.test(field) ||
        (key === "subject" && /[\r\n]/.test(field))) {
      throw new EmailTemplateError(`Enter a valid ${key === "text" ? "plain-text body" : key === "html" ? "HTML body" : "subject"}.`);
    }
    const allowed = new Set<string>(EMAIL_TEMPLATES[id].required);
    const tokens = [...field.matchAll(PLACEHOLDER)];
    if (tokens.some((match) => !allowed.has(match[1])) || /{{|}}/.test(field.replace(PLACEHOLDER, ""))) {
      throw new EmailTemplateError(`Use only the placeholders shown for ${EMAIL_TEMPLATES[id].label}.`);
    }
    if (key !== "subject" && EMAIL_TEMPLATES[id].required.some((name) => !tokens.some((match) => match[1] === name))) {
      throw new EmailTemplateError(`Include ${EMAIL_TEMPLATES[id].required.map((name) => `{{${name}}}`).join(" and ")} in both message bodies.`);
    }
    content[key] = field;
  }
  return content;
}

function settingKey(id: EmailTemplateId) {
  return `emailTemplate:${id}`;
}

export async function getEmailTemplate(id: EmailTemplateId) {
  const row = await prisma.appSetting.findUnique({ where: { key: settingKey(id) } });
  try {
    return { content: row ? validateEmailTemplate(id, row.value) : EMAIL_TEMPLATES[id].defaults as EmailTemplateContent,
      customized: Boolean(row) };
  } catch {
    return { content: EMAIL_TEMPLATES[id].defaults as EmailTemplateContent, customized: false };
  }
}

export async function saveEmailTemplate(id: EmailTemplateId, value: unknown) {
  const content = validateEmailTemplate(id, value);
  await prisma.appSetting.upsert({
    where: { key: settingKey(id) },
    create: { key: settingKey(id), value: content },
    update: { value: content }
  });
  return content;
}

export async function restoreEmailTemplate(id: EmailTemplateId) {
  await prisma.appSetting.deleteMany({ where: { key: settingKey(id) } });
  return EMAIL_TEMPLATES[id].defaults as EmailTemplateContent;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function renderEmailTemplate(id: EmailTemplateId, content: EmailTemplateContent, variables: Record<string, string>) {
  const validated = validateEmailTemplate(id, content);
  if (EMAIL_TEMPLATES[id].required.some((name) => !variables[name])) {
    throw new EmailTemplateError("A required email value is missing.");
  }
  const replace = (value: string, html: boolean) => value.replace(PLACEHOLDER, (_match, name: string) =>
    html ? escapeHtml(variables[name] ?? "") : variables[name] ?? "");
  return {
    subject: replace(validated.subject, false),
    text: replace(validated.text, false),
    html: replace(validated.html, true)
  };
}
