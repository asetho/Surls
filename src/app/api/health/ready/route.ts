import { readyHealthResponse } from "@/lib/health";

export async function GET() {
  return readyHealthResponse();
}
