import { after, NextResponse, type NextRequest } from "next/server";
import { hashToken } from "@/lib/crypto";
import { validateCsrf } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { passwordResetAvailable, requestPasswordReset } from "@/lib/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { readFormDataWithLimit, requestIp, requestOriginMatchesApp } from "@/lib/request";
import { verifyTurnstileChallenge } from "@/lib/turnstile";

function back(query: string) {
  return NextResponse.redirect(new URL(`/forgot-password?${query}`, appBaseUrl()), 303);
}

export async function POST(request: NextRequest) {
  if (!requestOriginMatchesApp(request)) return back("error=form");
  const parsed = await readFormDataWithLimit(request, 16 * 1024);
  if (!parsed.ok) return back("error=form");
  const form = parsed.value;
  try { validateCsrf(form); } catch { return back("error=form"); }
  if (!(await passwordResetAvailable())) return back("sent=1");
  if (!(await verifyTurnstileChallenge(form, request)).ok) return back("error=check");

  const value = form.get("email");
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 0 && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const source = requestIp(request);
    const [sourceRate, emailRate] = await Promise.all([
      checkRateLimit(`password-reset:source:${source}`, source === "unknown" ? 100 : 10, 60 * 60 * 1000),
      checkRateLimit(`password-reset:email:${hashToken(email)}`, 3, 60 * 60 * 1000)
    ]);
    if (sourceRate.allowed && emailRate.allowed) {
      after(async () => {
        try { await requestPasswordReset(email); } catch { console.error("Password reset request failed."); }
      });
    }
  }
  return back("sent=1");
}
