import { checkRateLimit } from "./rate-limit";

export const UPLOAD_MAX_CONCURRENT_REQUESTS = 4;
export const UPLOAD_MAX_CONCURRENT_PER_USER = 2;

// Route handlers and Server Actions can load separate server bundles in one
// process. Keep their shared admission count on the process global.
const uploadStateKey = Symbol.for("surls.upload-request-limits");
type UploadState = { active: number; byUser: Map<string, number> };
const uploadGlobal = globalThis as unknown as Record<symbol, UploadState | undefined>;
const uploadState = uploadGlobal[uploadStateKey] ??= { active: 0, byUser: new Map() };
uploadState.byUser ??= new Map();

export function checkUploadRateLimit(userId: string) {
  return checkRateLimit(`api:upload:${userId}`, 30, 60 * 1000);
}

export function acquireUploadRequest(userId: string) {
  const activeForUser = uploadState.byUser.get(userId) ?? 0;
  if (uploadState.active >= UPLOAD_MAX_CONCURRENT_REQUESTS || activeForUser >= UPLOAD_MAX_CONCURRENT_PER_USER) {
    return null;
  }
  uploadState.active += 1;
  uploadState.byUser.set(userId, activeForUser + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    uploadState.active = Math.max(0, uploadState.active - 1);
    const remainingForUser = (uploadState.byUser.get(userId) ?? 1) - 1;
    if (remainingForUser > 0) uploadState.byUser.set(userId, remainingForUser);
    else uploadState.byUser.delete(userId);
  };
}
