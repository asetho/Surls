type CspOptions = {
  isDev?: boolean;
  nonce?: string;
  extraSources?: CspExtraSources;
  upgradeInsecureRequests?: boolean;
};

type CspExtraSources = Partial<Record<"script" | "style" | "img" | "connect" | "frame" | "font" | "media", string[]>>;

function parseExtraSources(value?: string, { allowUnsafeScript = true } = {}) {
  if (!value) return [];

  return value
    .split(/[\s,]+/)
    .map((source) => source.trim())
    .filter(Boolean)
    .map((source) => {
      if (/[\r\n;]/.test(source)) {
        throw new Error(`Invalid CSP source "${source}". Extra CSP sources cannot contain semicolons or new lines.`);
      }

      if (!allowUnsafeScript && /^'?unsafe-(?:inline|eval)'?$/i.test(source)) {
        throw new Error(`Invalid CSP script source "${source}". Use nonces or an explicit host source instead.`);
      }

      return source;
    });
}

export function getCspExtraSources(env: Record<string, string | undefined> = process.env): CspExtraSources {
  return {
    script: parseExtraSources(env.SURLS_CSP_SCRIPT_SRC_EXTRA, { allowUnsafeScript: false }),
    style: parseExtraSources(env.SURLS_CSP_STYLE_SRC_EXTRA),
    img: parseExtraSources(env.SURLS_CSP_IMG_SRC_EXTRA),
    connect: parseExtraSources(env.SURLS_CSP_CONNECT_SRC_EXTRA),
    frame: parseExtraSources(env.SURLS_CSP_FRAME_SRC_EXTRA),
    font: parseExtraSources(env.SURLS_CSP_FONT_SRC_EXTRA),
    media: parseExtraSources(env.SURLS_CSP_MEDIA_SRC_EXTRA)
  };
}

export function buildContentSecurityPolicy({
  isDev = false,
  nonce,
  extraSources = getCspExtraSources(),
  upgradeInsecureRequests = true
}: CspOptions = {}) {
  const scriptSources = [
    "script-src",
    "'self'",
    nonce ? `'nonce-${nonce}'` : null,
    "https://cdn.asetho.com",
    "https://challenges.cloudflare.com",
    "https://static.addtoany.com",
    "https://static.cloudflareinsights.com",
    ...(extraSources.script ?? []),
    isDev ? "'unsafe-eval'" : null
  ].filter(Boolean);

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    ["img-src", "'self'", "data:", "https://cdn.asetho.com", "https://static.addtoany.com", "https://www.addtoany.com", ...(extraSources.img ?? [])].join(" "),
    scriptSources.join(" "),
    ["style-src", "'self'", "'unsafe-inline'", "https://cdn.asetho.com", "https://use.typekit.net", "https://p.typekit.net", ...(extraSources.style ?? [])].join(" "),
    [
      "connect-src",
      "'self'",
      "https://cdn.asetho.com",
      "https://p.typekit.net",
      "https://challenges.cloudflare.com",
      "https://cloudflareinsights.com",
      "https://static.addtoany.com",
      "https://www.addtoany.com",
      "https://stats.addtoany.com",
      ...(extraSources.connect ?? [])
    ].join(" "),
    ["frame-src", "'self'", "about:", "https://challenges.cloudflare.com", "https://static.addtoany.com", "https://www.addtoany.com", ...(extraSources.frame ?? [])].join(" "),
    ["font-src", "'self'", "https://cdn.asetho.com", "https://use.typekit.net", ...(extraSources.font ?? [])].join(" "),
    ["media-src", "'self'", "https://cdn.asetho.com", ...(extraSources.media ?? [])].join(" ")
  ];

  if (upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}
