type CspOptions = {
  isDev?: boolean;
  nonce?: string;
  upgradeInsecureRequests?: boolean;
};

export function buildContentSecurityPolicy({ isDev = false, nonce, upgradeInsecureRequests = true }: CspOptions = {}) {
  const scriptSources = [
    "script-src",
    "'self'",
    nonce ? `'nonce-${nonce}'` : null,
    "https://cdn.asetho.com",
    "https://challenges.cloudflare.com",
    "https://static.addtoany.com",
    "https://static.cloudflareinsights.com",
    isDev ? "'unsafe-eval'" : null
  ].filter(Boolean);

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https://cdn.asetho.com https://static.addtoany.com https://www.addtoany.com",
    scriptSources.join(" "),
    "style-src 'self' 'unsafe-inline' https://cdn.asetho.com https://use.typekit.net https://p.typekit.net",
    "connect-src 'self' https://cdn.asetho.com https://p.typekit.net https://challenges.cloudflare.com https://cloudflareinsights.com https://static.addtoany.com https://www.addtoany.com https://stats.addtoany.com",
    "frame-src 'self' about: https://challenges.cloudflare.com https://static.addtoany.com https://www.addtoany.com",
    "font-src 'self' https://cdn.asetho.com https://use.typekit.net",
    "media-src 'self' https://cdn.asetho.com"
  ];

  if (upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}
