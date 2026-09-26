import { checkRateLimit } from "./rate-limit";

export const UPLOAD_MAX_CONCURRENT_REQUESTS = 4;

// Route handlers and Server Actions can load separate server bundles in one
// process. Keep their shared admission count on the process global.
const uploadStateKey = Symbol.for("surls.upload-request-limits");
const uploadGlobal = globalThis as unknown as Record<symbol, { active: number } | undefined>;
const uploadState = uploadGlobal[uploadStateKey] ??= { active: 0 };

export function checkUploadRateLimit(userId: string) {
  return checkRateLimit(`api:upload:${userId}`, 30, 60 * 1000);
}

export function acquireUploadRequest() {
  if (uploadState.active >= UPLOAD_MAX_CONCURRENT_REQUESTS) return null;
  uploadState.active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    uploadState.active = Math.max(0, uploadState.active - 1);
  };
}
