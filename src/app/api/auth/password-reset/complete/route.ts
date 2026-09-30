import { NextResponse, type NextRequest } from "next/server";
import { hashToken } from "@/lib/crypto";
import { validateCsrf } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { completePasswordReset } from "@/lib/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { readFormDataWithLimit, requestIp, requestOriginMatchesApp } from "@/lib/request";

function back(error: string, token = "") {
  const url = new URL("/reset-password", appBaseUrl());
  url.searchParams.set(error === "done" ? "done" : "error", error === "done" ? "1" : error);
  if (token && error !== "done") url.searchParams.set("token", token);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  if (!requestOriginMatchesApp(request)) return back("form");
  const parsed = await readFormDataWithLimit(request, 16 * 1024);
  if (!parsed.ok) return back("form");
  const form = parsed.value;
  const value = form.get("token");
  const token = typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
  try { validateCsrf(form); } catch { return back("form", token); }
  const password = form.get("password");
  const confirmation = form.get("confirmPassword");
  if (typeof password !== "string" || typeof confirmation !== "string" ||
      password.length < 12 || password.length > 4096 || password !== confirmation) return back("password", token);
  if (!token) return back("invalid");
  const source = requestIp(request);
  const [sourceRate, tokenRate] = await Promise.all([
    checkRateLimit(`password-reset:complete:source:${source}`, source === "unknown" ? 100 : 20, 15 * 60 * 1000),
    checkRateLimit(`password-reset:complete:token:${hashToken(token)}`, 5, 15 * 60 * 1000)
  ]);
  if (!sourceRate.allowed || !tokenRate.allowed) return back("invalid");
  const result = await completePasswordReset(token, password);
  return back(result === "success" ? "done" : "invalid", result === "invalid" ? token : "");
}
