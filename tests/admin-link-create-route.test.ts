import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const links = vi.hoisted(() => ({ createLinkFromFormData: vi.fn() }));

vi.mock("@/app/admin/links/create-link", () => links);

import { POST } from "@/app/admin/links/create/route";

function request(origin: string | null) {
  return new NextRequest("http://localhost:3000/admin/links/create", {
    method: "POST",
    body: new FormData(),
    headers: origin === null ? {} : { origin }
  });
}

describe("POST /admin/links/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    links.createLinkFromFormData.mockResolvedValue({ id: "link_123" });
  });

  it.each([null, "https://other.example.test"])("rejects an invalid request origin before creating a link: %s", async (origin) => {
    expect((await POST(request(origin))).status).toBe(403);
    expect(links.createLinkFromFormData).not.toHaveBeenCalled();
  });

  it("creates a link from a same-origin form", async () => {
    const response = await POST(request("http://localhost:3000"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/links/link_123");
    expect(links.createLinkFromFormData).toHaveBeenCalledOnce();
  });

  it("returns 429 when the shared link creation budget is exhausted", async () => {
    links.createLinkFromFormData.mockRejectedValue(new Error("Too many links created. Please wait and try again."));

    const response = await POST(request("http://localhost:3000"));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Too many links created. Please wait and try again." });
  });
});
