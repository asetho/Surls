import { NextResponse, type NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { clearSessionCookie, destroySession, SESSION_COOKIE } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { validateCsrf } from "@/lib/csrf";
import { appBaseUrl } from "@/lib/env";
import { requestOriginMatchesApp } from "@/lib/request";

export async function POST(request: NextRequest) {
  if (!requestOriginMatchesApp(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const formData = await request.formData().catch(() => null);
  try {
    if (!formData) throw new Error("Missing form data.");
    validateCsrf(formData);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  await destroySession(token);
  await auditLog({ action: AuditAction.LOGOUT });
  const response = NextResponse.redirect(new URL("/admin", appBaseUrl()), 303);
  clearSessionCookie(response);
  return response;
}
