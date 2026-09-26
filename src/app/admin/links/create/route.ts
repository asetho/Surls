import { NextResponse, type NextRequest } from "next/server";
import { LINK_CREATE_RATE_LIMIT_MESSAGE } from "@/lib/link-create-limits";
import { requestOriginMatchesApp } from "@/lib/request";
import { createLinkFromFormData } from "../create-link";

export async function POST(request: NextRequest) {
  if (!requestOriginMatchesApp(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  let link: Awaited<ReturnType<typeof createLinkFromFormData>>;
  try {
    link = await createLinkFromFormData(await request.formData());
  } catch (error) {
    if (error instanceof Error && error.message === LINK_CREATE_RATE_LIMIT_MESSAGE) {
      return NextResponse.json({ error: LINK_CREATE_RATE_LIMIT_MESSAGE }, { status: 429 });
    }
    throw error;
  }
  if (!link) {
    return NextResponse.redirect(new URL("/admin?next=/admin/links", request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL(`/admin/links/${link.id}`, request.url), { status: 303 });
}
