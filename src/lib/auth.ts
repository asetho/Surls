import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { hashToken, randomToken } from "./crypto";
import { env, isProduction } from "./env";
import { requestIpHash } from "./request";

export const SESSION_COOKIE = "surls_session";

export async function createSession(userId: string, request: NextRequest) {
  const token = randomToken(36);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ipHash: requestIpHash(request),
      userAgent: request.headers.get("user-agent"),
      expiresAt
    }
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: now }
  });

  return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySession(token?: string) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
}

export async function getCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { totpCredential: true } } }
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    }
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  return session;
}

export async function requireAdmin() {
  const session = await getCurrentSession();
  if (!session) return null;
  return session.user;
}

export function redirectToLogin(requestUrl?: string) {
  const url = new URL("/login", env.BASE_URL);
  if (requestUrl) url.searchParams.set("next", requestUrl);
  return NextResponse.redirect(url);
}
