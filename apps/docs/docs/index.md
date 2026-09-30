<div class="surls-hero" markdown>

# Short links under your control

Surls is a self-hosted system for short links, redirects, shared files, and privacy-aware click analytics.

[Install Surls](getting-started/install.md){ .md-button .md-button--primary } [Explore features](guides/links-and-analytics.md){ .md-button }

</div>

## Start here

- [Check the requirements](getting-started/requirements.md), then [install with Docker Compose](getting-started/install.md).
- [Create your first link](getting-started/first-sign-in.md) and review [link management](guides/links-and-analytics.md).
- Set up [passkeys, 2FA, and external sign-in](guides/authentication.md).
- Connect [WordPress or the macOS share extension](guides/integrations.md).

Surls runs as a Next.js application with PostgreSQL. This documentation site and [surls.dev](https://surls.dev/) are built as static files for Cloudflare Pages; they do not host your short links or admin account. Choose your own domain for the Surls application and configure its `BASE_URL` to that origin.

The [source repository](https://github.com/asetho/Surls) contains the application, Compose files, and detailed operator guides. Use a pinned release image and read its release notes before updating.
