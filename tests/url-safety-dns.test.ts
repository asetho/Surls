import { beforeEach, describe, expect, it, vi } from "vitest";

const dnsMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  lookup: vi.fn(),
  resolve4: vi.fn(),
  resolve6: vi.fn()
}));

vi.mock("node:dns/promises", () => ({
  default: { lookup: dnsMocks.lookup },
  Resolver: class {
    cancel = dnsMocks.cancel;
    resolve4 = dnsMocks.resolve4;
    resolve6 = dnsMocks.resolve6;
  }
}));

import { resolveSafeHttpAddressWithTimeout } from "@/lib/url-safety";

function dnsError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("bounded destination DNS resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    dnsMocks.resolve4.mockResolvedValue(["93.184.216.34"]);
    dnsMocks.resolve6.mockRejectedValue(dnsError("ENODATA"));
  });

  it("accepts public answers when one address family has no records", async () => {
    await expect(resolveSafeHttpAddressWithTimeout("https://example.com/path", 2_000)).resolves.toEqual({
      address: "93.184.216.34",
      family: 4
    });
    expect(dnsMocks.cancel).not.toHaveBeenCalled();
  });

  it("rejects any private answer", async () => {
    dnsMocks.resolve4.mockResolvedValue(["93.184.216.34", "10.0.0.5"]);

    await expect(resolveSafeHttpAddressWithTimeout("https://example.com/path", 2_000)).rejects.toThrow(
      /private or internal/i
    );
  });

  it("cancels outstanding resolver work at the deadline", async () => {
    vi.useFakeTimers();
    dnsMocks.resolve4.mockReturnValue(new Promise(() => undefined));
    dnsMocks.resolve6.mockReturnValue(new Promise(() => undefined));

    const resolution = resolveSafeHttpAddressWithTimeout("https://slow.example/path", 50);
    const rejection = expect(resolution).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(50);

    await rejection;
    expect(dnsMocks.cancel).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
