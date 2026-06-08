import type { NextRequest } from "next/server";
import { handleShortRedirect } from "@/lib/redirect";

type Params = {
  params: Promise<{ code: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { code } = await params;
  return handleShortRedirect(request, code);
}
