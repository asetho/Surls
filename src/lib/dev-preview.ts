import { env } from "./env";

// The interactive previews are for the hmserv development deployment only.
export function hmservDevPreviewEnabled() {
  return env.SURLS_LOGIN_DEV_ENABLED && new URL(env.BASE_URL).hostname === "link.hm.aarn.cc";
}
