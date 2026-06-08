/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const scriptSrc = ["script-src 'self' 'unsafe-inline'", isProd ? "" : "'unsafe-eval'"].filter(Boolean).join(" ");

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
              "img-src 'self' data:",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "font-src 'self'",
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
