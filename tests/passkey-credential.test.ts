import { describe, expect, it } from "vitest";
import { parsePasskeyTransports, passkeyToWebAuthnCredential } from "@/lib/passkeys";

describe("stored passkey compatibility", () => {
  it("preserves existing and future transport hints when adapting a stored credential", () => {
    const transports = ["usb", "nfc", "ble", "internal", "hybrid", "cable", "smart-card"];
    expect(passkeyToWebAuthnCredential({
      credentialId: "credential-id",
      publicKey: "AQID",
      counter: 7n,
      transports: JSON.stringify(transports)
    })).toEqual({
      id: "credential-id",
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 7,
      transports
    });
  });

  it("ignores malformed and unknown transport hints", () => {
    expect(parsePasskeyTransports('["usb", "unknown", 1, null]')).toEqual(["usb"]);
    expect(parsePasskeyTransports('{"usb": true}')).toBeUndefined();
    expect(parsePasskeyTransports("invalid")).toBeUndefined();
    expect(parsePasskeyTransports(null)).toBeUndefined();
  });
});
