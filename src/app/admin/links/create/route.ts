import { NextResponse, type NextRequest } from "next/server";
import { createLinkFromFormData } from "../create-link";

export async function POST(request: NextRequest) {
  const link = await createLinkFromFormData(await request.formData());
  if (!link) {
    return NextResponse.redirect(new URL("/admin?next=/admin/links", request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL(`/admin/links/${link.id}`, request.url), { status: 303 });
}
