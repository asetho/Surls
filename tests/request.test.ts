import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { clientIpFromHeaders, readFormDataWithLimit } from "@/lib/request";

describe("request IP handling", () => {
  it("ignores forwarded IP headers unless proxy trust is enabled", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.2",
      "x-real-ip": "203.0.113.8"
    });

    expect(clientIpFromHeaders(headers, false)).toBe("unknown");
    expect(clientIpFromHeaders(headers, true)).toBe("203.0.113.7");
  });

  it("rejects malformed forwarded IP header values", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7:malformed",
      "x-real-ip": "not-an-ip"
    });

    expect(clientIpFromHeaders(headers, true)).toBe("unknown");
  });

  it("accepts valid bracketed IPv6 forwarded IP header values", () => {
    const headers = new Headers({
      "x-forwarded-for": "[2001:db8::1]"
    });

    expect(clientIpFromHeaders(headers, true)).toBe("2001:db8::1");
  });
});

describe("bounded multipart parsing", () => {
  it("parses a multipart form below the byte limit", async () => {
    const formData = new FormData();
    formData.set("name", "favicon");
    const request = new NextRequest("http://localhost:3000/upload", { body: formData, method: "POST" });

    const result = await readFormDataWithLimit(request, 1024);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.get("name")).toBe("favicon");
  });

  it("rejects an oversized declared body before parsing", async () => {
    const request = new NextRequest("http://localhost:3000/upload", {
      body: "oversized",
      headers: { "content-length": "10000", "content-type": "multipart/form-data; boundary=test" },
      method: "POST"
    });

    await expect(readFormDataWithLimit(request, 1024)).resolves.toEqual({ ok: false, error: "too_large" });
  });
});
