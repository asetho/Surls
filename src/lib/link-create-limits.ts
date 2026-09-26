import { checkRateLimit } from "./rate-limit";

export const LINK_CREATE_RATE_LIMIT_MESSAGE = "Too many links created. Please wait and try again.";

export function checkLinkCreationRateLimit(userId: string) {
  return checkRateLimit(`api:create:${userId}`, 60, 60 * 1000);
}
