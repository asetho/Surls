type CspOptions = {
  isDev?: boolean;
  nonce?: string;
};

export function buildContentSecurityPolicy({ isDev = false, nonce }: CspOptions = {}) {
  const scriptSources = [
    "script-src",
    "'self'",
    nonce ? `'nonce-${nonce}'` : null,
    "https://cdn.asetho.com",
    "https://static.cloudflareinsights.com",
    isDev ? "'unsafe-eval'" : null
  ].filter(Boolean);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https://cdn.asetho.com",
    scriptSources.join(" "),
    "style-src 'self' 'unsafe-inline' https://cdn.asetho.com https://use.typekit.net https://p.typekit.net",
    "connect-src 'self' https://cdn.asetho.com https://p.typekit.net https://cloudflareinsights.com",
    "frame-src 'self' about:",
    "font-src 'self' https://cdn.asetho.com https://use.typekit.net",
    "media-src 'self' https://cdn.asetho.com",
    "upgrade-insecure-requests"
  ].join("; ");
}
