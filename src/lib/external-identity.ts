import { Prisma, UserRole } from "@prisma/client";
import { randomToken } from "./crypto";
import { type ExternalIdentityProfile } from "./external-auth";
import { externalProviderKey, type ExternalProviderConfig } from "./external-provider-settings";
import { hashPassword } from "./password";
import { prisma } from "./prisma";
import { getSetting } from "./settings";

export class ExternalIdentityError extends Error {}

function verifiedEmail(profile: ExternalIdentityProfile) {
  const email = profile.email?.trim().toLowerCase() ?? "";
  return profile.emailVerified && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function resolveExternalIdentity(config: ExternalProviderConfig, profile: ExternalIdentityProfile, linkUserId: string | null) {
  const providerKey = externalProviderKey(config);
  if (!profile.subject || profile.subject.length > 512) throw new ExternalIdentityError("The provider returned an invalid identity.");
  const email = verifiedEmail(profile);
  const autoProvision = await getSetting("externalAutoProvisionUsers");
  const randomPasswordHash = !linkUserId && email && autoProvision ? await hashPassword(randomToken(48)) : null;

  return prisma.$transaction(async (tx) => {
    const existingIdentity = await tx.externalIdentity.findUnique({ where: { provider_subject: { provider: providerKey, subject: profile.subject } } });
    if (linkUserId) {
      if (existingIdentity) {
        if (existingIdentity.userId !== linkUserId) throw new ExternalIdentityError("That external account is connected to another Surls user.");
        return linkUserId;
      }
      await tx.externalIdentity.create({ data: { provider: providerKey, subject: profile.subject, userId: linkUserId } });
      return linkUserId;
    }
    if (existingIdentity) return existingIdentity.userId;
    if (!email) throw new ExternalIdentityError("Connect this provider from your Surls profile before using it to sign in.");
    let user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (!user && randomPasswordHash) {
      user = await tx.user.create({ data: {
        email, name: profile.name?.trim().slice(0, 120) || null,
        passwordHash: randomPasswordHash, role: UserRole.USER
      }, select: { id: true } });
    }
    if (!user) throw new ExternalIdentityError("No Surls user has this verified email address. Ask an admin to create one.");
    await tx.externalIdentity.create({ data: { provider: providerKey, subject: profile.subject, userId: user.id } });
    return user.id;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function isConfiguredExternalIdentity(providerKey: string, configs: ExternalProviderConfig[]) {
  return configs.some((config) => externalProviderKey(config) === providerKey);
}
