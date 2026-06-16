import { describe, expect, it } from "vitest";
import { appendForwardedQuery, isPrivateAddress, parseSafeHttpUrl } from "@/lib/url-safety";

describe("URL safety", () => {
  it("accepts public http and https destinations", () => {
    expect(parseSafeHttpUrl("https://example.com/a?b=c").ok).toBe(true);
    expect(parseSafeHttpUrl("http://example.com").ok).toBe(true);
    expect(parseSafeHttpUrl("https://[2606:4700:4700::1111]/").ok).toBe(true);
  });

  it("rejects unsafe protocols and local destinations", () => {
    expect(parseSafeHttpUrl("javascript:alert(1)").ok).toBe(false);
    expect(parseSafeHttpUrl("data:text/html,hi").ok).toBe(false);
    expect(parseSafeHttpUrl("file:///etc/passwd").ok).toBe(false);
    expect(parseSafeHttpUrl("http://localhost:3000").ok).toBe(false);
    expect(parseSafeHttpUrl("http://127.0.0.1").ok).toBe(false);
    expect(parseSafeHttpUrl("http://192.168.1.5").ok).toBe(false);
    expect(parseSafeHttpUrl("http://[::1]/").ok).toBe(false);
    expect(parseSafeHttpUrl("http://[fe80::1]/").ok).toBe(false);
    expect(parseSafeHttpUrl("http://[fd00::1]/").ok).toBe(false);
    expect(parseSafeHttpUrl("http://[::ffff:127.0.0.1]/").ok).toBe(false);
    expect(parseSafeHttpUrl("http://[::ffff:172.16.0.1]/").ok).toBe(false);
    expect(parseSafeHttpUrl("http://[::ffff:192.168.1.1]/").ok).toBe(false);
  });

  it("detects private address ranges", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("[::1]")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("fe90::1")).toBe(true);
    expect(isPrivateAddress("ff02::1")).toBe(true);
    expect(isPrivateAddress("::ffff:172.16.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:ac10:1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("preserves destination query values when forwarding incoming query strings", () => {
    expect(appendForwardedQuery("https://example.com/path?utm_source=existing", "utm_source=new&x=1")).toBe(
      "https://example.com/path?utm_source=existing&x=1"
    );
  });
});
