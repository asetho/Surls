function countryName(country: string | null) {
  if (!country) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? country;
  } catch {
    return country;
  }
}

export function sessionLocationLabel(country: string | null, region: string | null) {
  const parts = [region, countryName(country)].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unavailable";
}

export function sessionClientSummary(userAgent: string | null) {
  const ua = userAgent ?? "";
  const client = /\bSurls(?:Share)?[\s/]/i.test(ua)
    ? "Surls app"
    : /Edg(?:A|iOS)?\//.test(ua)
      ? "Microsoft Edge"
      : /(?:OPR|Opera)\//.test(ua)
        ? "Opera"
        : /(?:Chrome|CriOS)\//.test(ua)
          ? "Google Chrome"
          : /(?:Firefox|FxiOS)\//.test(ua)
            ? "Mozilla Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Unknown browser or app";

  const device = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? "Android phone"
          : "Android device"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows NT/.test(ua)
            ? "Windows PC"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux computer"
                : /Mobile/.test(ua)
                  ? "Mobile device"
                  : "Unknown device";

  return { client, device };
}
