import nodemailer from "nodemailer";
import { getSmtpTransportConfig } from "./smtp-settings";

export async function profileEmailAvailable() {
  return Boolean(await getSmtpTransportConfig());
}

async function sendEmail(to: string, subject: string, message: string) {
  const config = await getSmtpTransportConfig();
  if (!config) throw new Error("SMTP is not configured.");
  const transport = nodemailer.createTransport({
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
  try {
    await transport.sendMail({
      from: config.from,
      to,
      subject,
      text: message
    });
  } finally {
    transport.close();
  }
}

export async function sendProfileEmailCode(to: string, code: string) {
  await sendEmail(to, "Surls email change verification code",
    `Your Surls email change verification code is ${code}. It expires in 10 minutes. If you did not request this change, you can ignore this email.`);
}

export async function sendExternalConnectCode(to: string, code: string) {
  await sendEmail(to, "Surls sign-in provider connection verification code",
    `Your Surls sign-in provider connection verification code is ${code}. It expires in 10 minutes. If you did not request this connection, you can ignore this email.`);
}

export async function sendTotpSetupEmailCode(to: string, code: string) {
  await sendEmail(to, "Surls authenticator setup verification code",
    `Your Surls authenticator setup verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`);
}

export async function sendSmtpTestEmail(to: string) {
  await sendEmail(to, "Surls SMTP test", "Your Surls email settings are working.");
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendEmail(to, "Reset your Surls password",
    `A password reset was requested for your Surls account. Open this link within 15 minutes:\n\n${resetUrl}\n\nIf you did not request this, ignore this email. Your password has not changed.`);
}

export async function sendPasswordChangedEmail(to: string) {
  await sendEmail(to, "Your Surls password was changed",
    "Your Surls password was changed and existing sessions were signed out. If you did not make this change, contact your site administrator immediately.");
}
