export type DestinationWarning = {
  code: "http" | "ip-address" | "punycode" | "userinfo";
  message: string;
};

function isIpLiteral(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized) || normalized.includes(":");
}

function hasPunycodeLabel(hostname: string) {
  return hostname
    .toLowerCase()
    .split(".")
    .some((label) => label.startsWith("xn--"));
}

export function destinationWarnings(value: string): DestinationWarning[] {
  const text = value.trim();
  if (!text) return [];

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return [];
  }

  const warnings: DestinationWarning[] = [];
  if (url.protocol === "http:") {
    warnings.push({
      code: "http",
      message: "This destination uses HTTP. Use HTTPS when the destination supports it."
    });
  }
  if (url.username || url.password) {
    warnings.push({
      code: "userinfo",
      message: "This URL includes text before the hostname. Double-check the real destination domain."
    });
  }
  if (isIpLiteral(url.hostname)) {
    warnings.push({
      code: "ip-address",
      message: "This destination points directly to an IP address. Make sure that is intentional."
    });
  }
  if (hasPunycodeLabel(url.hostname)) {
    warnings.push({
      code: "punycode",
      message: "This domain uses punycode, which can hide look-alike characters. Double-check the spelling."
    });
  }
  return warnings;
}
