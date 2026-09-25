import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const SIGN_IN_CONFIGURATION_LOCK_ID = 2_047_815_304;

// Keep availability checks and writes together across provider and login-mode
// changes, including requests handled by different application instances.
export function withSignInConfiguration<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${SIGN_IN_CONFIGURATION_LOCK_ID})`;
    return operation(transaction);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
