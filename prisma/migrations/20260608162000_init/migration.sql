-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'TOTP_ENABLED', 'TOTP_DISABLED', 'BACKUP_CODES_REGENERATED', 'BACKUP_CODE_USED', 'PASSKEY_ADDED', 'PASSKEY_REMOVED', 'SHORT_LINK_CREATED', 'SHORT_LINK_UPDATED', 'SHORT_LINK_DELETED', 'SHORT_LINK_ARCHIVED', 'API_TOKEN_CREATED', 'API_TOKEN_REVOKED', 'SETTINGS_CHANGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TotpCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enabledAt" TIMESTAMP(3),

    CONSTRAINT "TotpCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "BackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "maxClicks" INTEGER,
    "passwordHash" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastClickedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickEvent" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "device" TEXT,
    "country" TEXT,
    "region" TEXT,
    "ipHash" TEXT,
    "visitorHash" TEXT,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortLinkTag" (
    "shortLinkId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ShortLinkTag_pkey" PRIMARY KEY ("shortLinkId","tagId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CookieConsent" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "essential" BOOLEAN NOT NULL DEFAULT true,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CookieConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TotpCredential_userId_key" ON "TotpCredential"("userId");

-- CreateIndex
CREATE INDEX "BackupCode_userId_usedAt_idx" ON "BackupCode"("userId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE INDEX "Passkey_userId_idx" ON "Passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");

-- CreateIndex
CREATE INDEX "ShortLink_createdAt_idx" ON "ShortLink"("createdAt");

-- CreateIndex
CREATE INDEX "ShortLink_enabled_expiresAt_idx" ON "ShortLink"("enabled", "expiresAt");

-- CreateIndex
CREATE INDEX "ShortLink_clickCount_idx" ON "ShortLink"("clickCount");

-- CreateIndex
CREATE INDEX "ClickEvent_shortLinkId_occurredAt_idx" ON "ClickEvent"("shortLinkId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClickEvent_occurredAt_idx" ON "ClickEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_revokedAt_idx" ON "ApiToken"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CookieConsent_consentId_key" ON "CookieConsent"("consentId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TotpCredential" ADD CONSTRAINT "TotpCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupCode" ADD CONSTRAINT "BackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLinkTag" ADD CONSTRAINT "ShortLinkTag_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLinkTag" ADD CONSTRAINT "ShortLinkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

