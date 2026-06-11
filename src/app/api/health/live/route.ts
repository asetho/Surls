import { liveHealthResponse } from "@/lib/health";

export function GET() {
  return liveHealthResponse();
}
