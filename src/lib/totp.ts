import { generateSecret, generateURI, verify } from "otplib";
import { encryptSecret, decryptSecret } from "./crypto";

export function createTotpSecret(email: string, issuer: string) {
  const secret = generateSecret();
  const otpauthUrl = totpOtpAuthUrl(email, secret, issuer);
  return {
    secret,
    encryptedSecret: encryptSecret(secret),
    otpauthUrl
  };
}

export function totpOtpAuthUrl(email: string, secret: string, issuer: string) {
  return generateURI({
    issuer,
    label: email,
    secret,
    period: 30,
    digits: 6
  });
}

export function getTotpSecret(encryptedSecret: string) {
  return decryptSecret(encryptedSecret);
}

export async function verifyTotpCode(encryptedSecret: string, code: string) {
  const result = await verify({
    secret: getTotpSecret(encryptedSecret),
    token: code.replace(/\s+/g, ""),
    period: 30,
    digits: 6,
    epochTolerance: 30
  });
  return result.valid;
}
