/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const scriptSrc = [
      "script-src 'self' 'unsafe-inline' https://static.addtoany.com https://cdn.asetho.com https://static.cloudflareinsights.com",
      isProd ? "" : "'unsafe-eval'"
    ]
      .filter(Boolean)
      .join(" ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "img-src 'self' data: https://static.addtoany.com https://cdn.asetho.com",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://static.addtoany.com https://cdn.asetho.com https://use.typekit.net https://p.typekit.net",
              "connect-src 'self' https://static.addtoany.com https://www.addtoany.com https://cdn.asetho.com https://p.typekit.net https://cloudflareinsights.com",
              "frame-src 'self' https://www.addtoany.com",
              "font-src 'self' https://cdn.asetho.com https://use.typekit.net",
              "media-src 'self' https://cdn.asetho.com",
              "upgrade-insecure-requests"
            ].join("; ")
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains"
                }
              ]
            : [])
        ]
      }
    ];
  }
};

export default nextConfig;
