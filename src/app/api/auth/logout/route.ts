import { NextResponse, type NextRequest } from "next/server";
import { AuditAction } from "@prisma/client";
import { clearSessionCookie, destroySession, SESSION_COOKIE } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  await destroySession(token);
  await auditLog({ action: AuditAction.LOGOUT });
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  clearSessionCookie(response);
  return response;
}
