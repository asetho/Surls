CREATE TABLE "ExternalProviderSetting" (
    "provider" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "issuer" TEXT,
    "tenantId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalProviderSetting_pkey" PRIMARY KEY ("provider")
);
