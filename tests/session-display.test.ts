import { describe, expect, it } from "vitest";
import { sessionClientSummary, sessionLocationLabel } from "@/lib/session-display";

describe("session display", () => {
  it("identifies browsers and devices from saved user agents", () => {
    expect(
      sessionClientSummary(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36"
      )
    ).toEqual({ client: "Google Chrome", device: "Mac" });
    expect(
      sessionClientSummary(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 OPR/121.0.0.0"
      )
    ).toEqual({ client: "Opera", device: "Windows PC" });
    expect(
      sessionClientSummary(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
      )
    ).toEqual({ client: "Safari", device: "iPhone" });
  });

  it("formats coarse location without requiring an IP address", () => {
    expect(sessionLocationLabel("US", "Pennsylvania")).toBe("Pennsylvania, United States");
    expect(sessionLocationLabel(null, null)).toBe("Unavailable");
    expect(sessionLocationLabel(null, null, true)).toBe("Local network");
  });
});
