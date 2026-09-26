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

import { DESTINATION_DNS_TIMEOUT_MS, resolveSafeHttpAddress, resolveSafeHttpAddressWithTimeout } from "@/lib/url-safety";

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
    expect(dnsMocks.cancel).not.toHaveBeenCalled();
  });

  it("cancels the other address family when one DNS query fails early", async () => {
    vi.useFakeTimers();
    let rejectIpv6!: (error: Error) => void;
    dnsMocks.resolve4.mockRejectedValue(dnsError("ESERVFAIL"));
    dnsMocks.resolve6.mockReturnValue(new Promise<string[]>((_, reject) => {
      rejectIpv6 = reject;
    }));
    dnsMocks.cancel.mockImplementation(() => rejectIpv6(dnsError("ECANCELLED")));

    await expect(resolveSafeHttpAddressWithTimeout("https://failing.example/path", 50)).rejects.toMatchObject({
      code: "ESERVFAIL"
    });
    expect(dnsMocks.cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
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

  it("bounds the default destination resolver used by link and title requests", async () => {
    vi.useFakeTimers();
    dnsMocks.resolve4.mockReturnValue(new Promise(() => undefined));
    dnsMocks.resolve6.mockReturnValue(new Promise(() => undefined));

    const resolution = resolveSafeHttpAddress("https://slow.example/path");
    const rejection = expect(resolution).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(DESTINATION_DNS_TIMEOUT_MS);

    await rejection;
    expect(dnsMocks.cancel).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("caps concurrent public DNS resolutions and releases slots after timeouts", async () => {
    vi.useFakeTimers();
    dnsMocks.resolve4.mockReturnValue(new Promise(() => undefined));
    dnsMocks.resolve6.mockReturnValue(new Promise(() => undefined));

    const pending = Array.from({ length: 8 }, (_, index) =>
      resolveSafeHttpAddressWithTimeout(`https://slow${index}.example/`, 50)
    );
    await expect(resolveSafeHttpAddressWithTimeout("https://blocked.example/", 50)).rejects.toThrow(
      /too many destination dns lookups/i
    );
    expect(dnsMocks.resolve4).toHaveBeenCalledTimes(8);
    const rejections = pending.map((lookup) => expect(lookup).rejects.toThrow(/timed out/i));
    await vi.advanceTimersByTimeAsync(50);
    await Promise.all(rejections);
    expect(dnsMocks.cancel).toHaveBeenCalledTimes(8);

    dnsMocks.resolve4.mockResolvedValue(["93.184.216.34"]);
    dnsMocks.resolve6.mockRejectedValue(dnsError("ENODATA"));
    await expect(resolveSafeHttpAddressWithTimeout("https://recovered.example/", 50)).resolves.toEqual({
      address: "93.184.216.34",
      family: 4
    });
    vi.useRealTimers();
  });

  it("preserves system lookup for explicitly allowed private destinations", async () => {
    dnsMocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    await expect(resolveSafeHttpAddressWithTimeout("http://internal.test/path", 2_000, true)).resolves.toEqual({
      address: "127.0.0.1",
      family: 4
    });
    expect(dnsMocks.lookup).toHaveBeenCalledWith("internal.test", { all: true, verbatim: true });
    expect(dnsMocks.resolve4).not.toHaveBeenCalled();
  });

  it("times out private-mode system lookups and caps outstanding work", async () => {
    vi.useFakeTimers();
    const releases: Array<(records: Array<{ address: string; family: number }>) => void> = [];
    dnsMocks.lookup.mockImplementation(() => new Promise((resolve) => { releases.push(resolve); }));

    const pending = Array.from({ length: 8 }, (_, index) =>
      resolveSafeHttpAddressWithTimeout(`http://internal${index}.test/`, 50, true)
    );
    const blocked = resolveSafeHttpAddressWithTimeout("http://internal9.test/", 50, true);
    await expect(blocked).rejects.toThrow(/too many destination dns lookups/i);
    const rejections = pending.map((lookup) => expect(lookup).rejects.toThrow(/timed out/i));
    await vi.advanceTimersByTimeAsync(50);
    await Promise.all(rejections);
    expect(dnsMocks.lookup).toHaveBeenCalledTimes(8);

    for (const release of releases) release([{ address: "127.0.0.1", family: 4 }]);
    await vi.advanceTimersByTimeAsync(0);
    dnsMocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(resolveSafeHttpAddressWithTimeout("http://recovered.test/", 50, true)).resolves.toMatchObject({
      address: "127.0.0.1"
    });
    vi.useRealTimers();
  });

  it("shares the public DNS cap across separately loaded server bundles", async () => {
    vi.useFakeTimers();
    dnsMocks.resolve4.mockReturnValue(new Promise(() => undefined));
    dnsMocks.resolve6.mockReturnValue(new Promise(() => undefined));

    const first = Array.from({ length: 4 }, (_, index) =>
      resolveSafeHttpAddressWithTimeout(`https://first${index}.example/`, 50)
    );
    vi.resetModules();
    const secondBundle = await import("@/lib/url-safety");
    const second = Array.from({ length: 4 }, (_, index) =>
      secondBundle.resolveSafeHttpAddressWithTimeout(`https://second${index}.example/`, 50)
    );
    await expect(secondBundle.resolveSafeHttpAddressWithTimeout("https://blocked.example/", 50)).rejects.toThrow(
      /too many destination dns lookups/i
    );

    const rejections = [...first, ...second].map((resolution) => expect(resolution).rejects.toThrow(/timed out/i));
    await vi.advanceTimersByTimeAsync(50);
    await Promise.all(rejections);
    vi.useRealTimers();
  });
});
