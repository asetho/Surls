import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

async function withUploadsRoute(
  run: (route: typeof import("@/app/uploads/[...path]/route")) => Promise<void>
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "surls-upload-route-"));
  await writeFile(path.join(dir, "payload.html"), "<script>window.pwned = true</script>");
  vi.resetModules();
  vi.stubEnv("UPLOADS_DIR", dir);
  try {
    await run(await import("@/app/uploads/[...path]/route"));
  } finally {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  }
}

describe("uploaded file route", () => {
  it("forces downloads for uploaded active content while preserving the file response", async () => {
    await withUploadsRoute(async ({ GET, HEAD }) => {
      const params = { params: Promise.resolve({ path: ["payload.html"] }) };

      const getResponse = await GET(new Request("http://localhost:3000/uploads/payload.html"), params);
      expect(getResponse.status).toBe(200);
      expect(getResponse.headers.get("content-disposition")).toBe("attachment");
      expect(getResponse.headers.get("content-type")).toBe("text/html; charset=utf-8");
      await expect(getResponse.text()).resolves.toBe("<script>window.pwned = true</script>");

      const headResponse = await HEAD(new Request("http://localhost:3000/uploads/payload.html"), params);
      expect(headResponse.status).toBe(200);
      expect(headResponse.headers.get("content-disposition")).toBe("attachment");
      await expect(headResponse.text()).resolves.toBe("");
    });
  });
});
