import { NextResponse, type NextRequest } from "next/server";
import { API_TOKEN_SCOPE_LINKS_CREATE, authenticateApiToken } from "@/lib/api-tokens";

export async function GET(request: NextRequest) {
  const token = await authenticateApiToken(request.headers.get("authorization"), API_TOKEN_SCOPE_LINKS_CREATE);
  return NextResponse.json(
    token ? { ok: true } : { error: "Unauthorized" },
    { status: token ? 200 : 401, headers: { "Cache-Control": "no-store" } }
  );
}
