# Surls

Surls is a short URL system for managing short links, redirects, and click statistics.

It is inspired by the product shape of URL shorteners such as YOURLS and Tiny.cc, but the code, branding, UI, and implementation are original to this project.

## Screenshots

The included Surls UI uses the default branding and palettes. These dashboard examples use synthetic data; a fresh installation starts with an empty dashboard.

![Default Surls dashboard in light mode](docs/screenshots/default-dashboard-light.jpg)

The public webroot can provide a completely custom site. Here is [asetho.link](https://asetho.link/) as an owner-customized example:

![Custom public homepage at asetho.link](docs/screenshots/asetho-custom-home.jpg)

The admin interface also supports custom theme colors. These examples use **asetho.link's custom light and dark palettes**, rendered locally with sample account details, links, and statistics:

| Custom light theme | Custom dark theme |
| --- | --- |
| ![asetho.link custom light admin dashboard](docs/screenshots/asetho-custom-dashboard-light.jpg) | ![asetho.link custom dark admin dashboard](docs/screenshots/asetho-custom-dashboard-dark.jpg) |

Configure your own palettes under **Settings → Dashboard theme → Open Theme Editor**. See the [full screenshot gallery](docs/screenshots/README.md) for larger custom admin images, the included homepage, login, fresh-install dashboard, default dark theme, and mobile views.

## Documentation

- [Docker Compose installation, configuration, upgrades, and backups](docs/deployment.md)
- [External sign-in, account linking, Keycloak, and MFA](docs/external-sign-in.md)
- [Surls Share for macOS — unsigned builds and local signing](Share-App/README.md)
- [WordPress link-creation plugin](wordpress/surls-link-creator/README.md)
- [Versioning and release-note format](VERSIONING.md) · [Changelog](CHANGELOG.md)

## What It Includes

- Built-in informational homepage with a mounted public webroot for owner-controlled overrides and additional static files.
- Secure admin login with Argon2id password hashing, HttpOnly sessions, CSRF-protected admin forms, login rate limiting, TOTP, backup codes, passkey sign-in, and optional external providers.
- TOTP 2FA setup with QR/manual key verification.
- One-time backup codes stored only as hashes.
- Admin dashboard with totals, recent activity, top links, and attention states.
- Link management with generated or custom aliases, safe destination validation, destination warnings, tags, notes, expiration, max-click limits, enable/disable, archive, QR codes, copy/share buttons, and CSV stats export.
- Redirects at `/:code` and `/s/:code`.
- Admin clicks excluded from statistics by default, controlled by the Settings page switch “Track admin clicks”.
- Detailed redirect analytics skip privacy opt-out requests and high-volume click bursts while still sending visitors to the destination.
- Privacy-respecting click stats: timestamp, referrer, user-agent-derived browser/device, hashed IP-derived values, raw IP retention limited to 30 days, and configurable click-event retention.
- Optional owner-provided public pages from the mounted webroot.
- Tools page with bookmarklet, API token generation/revocation, CSV import preview/import, exports, SSRF-aware link checker, UTM builder, cleanup summaries, API docs, and system info.
- Light, Dark, and Auto theme modes. Auto follows the operating system preference.
- Prisma PostgreSQL schema and versioned migrations.
- Dockerfile, production entrypoint, and a standard Docker Compose deployment.
- GitHub Actions for linting, typechecking, tests, production build, Docker smoke testing, and GHCR image publishing.

## Stack

- Node.js 26+
- Next.js 16 App Router
- React 19
- TypeScript
- PostgreSQL
- Prisma 7
- Vitest
- Docker Compose

## Install with Docker Compose

Follow the [deployment guide](docs/deployment.md) for the supported Compose setup. It covers the required secrets, writable uploads directory, read-only public webroot, first admin, HTTPS proxy, health checks, upgrades, and backups. Published images are available at `ghcr.io/asetho/surls`; pin a release tag for predictable upgrades.

## Local development

Requires Node.js 26+, npm, and a running PostgreSQL database (the included Compose stack uses PostgreSQL 18).

1. Install the locked dependencies and copy the environment template:

   ```bash
   npm ci
   cp .env.example .env
   ```

2. Set `DATABASE_URL` to a dedicated local database and `BASE_URL` to `http://localhost:3000`. Generate an `AUTH_SECRET` with `openssl rand -base64 32` and save it in `.env`. For local public-page overrides, set `PUBLIC_WEBROOT_DIR` to an existing absolute path. Next.js loads `.env` for development.
3. Generate the Prisma client, apply migrations, and seed missing settings:

   ```bash
   npm run prisma:generate
   npm run prisma:deploy
   node --env-file=.env --run seed
   ```

4. Create the first admin (password must be at least 12 characters), then start the app:

   ```bash
   node --env-file=.env --run setup:admin
   npm run dev
   ```

Open `/admin` to sign in. The command-line setup prompt echoes the entered password; use a private terminal. The root Compose database has no published host port, so starting its `db` service alone does **not** make `localhost:5432` available to a host-run development server. Use a separate local database or an explicit loopback-only port mapping for development.

`npm run seed:demo` adds sample links and click history. Use it only against a disposable development database, with `DATABASE_URL` loaded into the process environment; it is not required for installation.

## External sign-in

Site admins can set up Keycloak/OIDC and independent Google, GitHub, Discord, Microsoft, Facebook, or X sign-in from the gear beside **Settings → Sign-in methods**. See the [external sign-in guide](docs/external-sign-in.md). Settings can also disable local password and passkey sign-in after an external account has been connected and tested.

## Public Webroot

The public side of Surls is served from a read-only mounted webroot. In Docker Compose, set `SURLS_PUBLIC_WEBROOT_PATH` to the host directory you want to use; the container reads it at `/app/www`.

```env
SURLS_PUBLIC_WEBROOT_PATH="./www"
```

Create that host directory before starting Docker. The compose bind mount uses `create_host_path: false`, so Docker will fail fast instead of silently creating a default directory in the wrong place.

The container runs as UID/GID `1000:1000`. That user needs traverse permission on the webroot and its public subdirectories, plus read permission on each page and asset it serves. Existing ownership can remain unchanged. The readiness check verifies the webroot and `index.html`, `404.html`, and `unavailable.html` when present. Check other public assets and the `login.html` template from inside the running container after copying or syncing files.

If you set `PUBLIC_WEBROOT_DIR` or `CUSTOM_PAGES_DIR` directly without Docker Compose, use an absolute path.

Public file behavior:

- `/` serves `index.html` when present; otherwise it serves the built-in Surls homepage.
- Missing public paths and missing short links serve `404.html` with HTTP 404 when present.
- Other files and directories are served directly, such as `/test.html`, `/assets/site.css`, or `/docs/index.html`.
- Exact public files win before short-link redirects, so `/test.html` serves the file if it exists; otherwise one-segment paths can still resolve as short links.
- App-owned paths such as `/admin`, `/api`, `/_next`, `/health`, and `/s/:code` remain reserved.

`login.html` in the webroot is reserved for the app-owned admin login template and is not served as a public file. It must include exactly one `{{LOGIN_FORM}}` placeholder where the secure Surls login form should appear. You can also place optional `{{LOGIN_TITLE}}` and `{{LOGIN_TAGLINE}}` placeholders anywhere in the template; Surls replaces them with the current login-step heading text. The inserted form exposes stable styling hooks such as `[data-surls-auth-form]`, `[data-surls-auth-input]`, `[data-surls-auth-submit]`, `[data-surls-auth-secondary]`, and `[data-surls-auth-passkey]`, plus CSS variables like `--surls-login-input-background` and `--surls-login-button-background`. Custom secondary buttons, including SSO links, share `--surls-login-secondary-border`, `--surls-login-secondary-hover-border`, and `--surls-login-secondary-hover-background`. Keyboard focus uses `--surls-login-focus-color`, falling back to the custom primary button color.

Admin-managed favicons can be uploaded from Settings without writing to the read-only webroot. Uploaded favicons are served from standard root URLs that custom pages can reference directly: `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, and `/site.webmanifest`. If no admin-managed favicon package is configured, these paths fall back to matching files in the public webroot when present.

Public webroot HTML is served as same-origin trusted owner content. Keep this directory writable only by trusted admins. If you want stronger isolation for arbitrary third-party HTML, serve that content from a separate domain.

Keep backups, credentials, and other private files outside the public webroot. Readable files beneath it, including files in subdirectories, may be served by URL.

## Uploaded Files

Admins can upload files from Tools -> Upload & Shorten. Files are stored under opaque names in `UPLOADS_DIR` and are available only through their short links. `UPLOADS_DIR` defaults to `uploads` under the app working directory. Docker Compose bind-mounts the host directory configured by `SURLS_UPLOADS_PATH` at `/app/uploads`. Uploads have a process-safe 25 MB request ceiling; `UPLOAD_MAX_BYTES` can lower that limit. Uploads also default to a 1 GiB per-user storage quota and a 10 GiB site storage quota, configurable with `UPLOAD_USER_STORAGE_QUOTA_BYTES` and `UPLOAD_SITE_STORAGE_QUOTA_BYTES`; existing files are reconciled into quota metadata before a new upload is reserved.

```env
SURLS_UPLOADS_PATH="./uploads"
```

Create the host directory before starting Docker and make it writable by UID/GID `1000:1000`, the unprivileged `node` user that runs Surls in the container:

```bash
mkdir -p ./uploads
sudo chown -R 1000:1000 ./uploads
```

The upload bind mount uses `create_host_path: false`, so a missing or incorrect path fails fast instead of creating an unintended directory. Existing installations must update the directory ownership before recreating the app container. If an installation still uses the former `surls-uploads` named volume, copy its contents into the configured host directory before recreating the app container and keep the old volume until the migrated files have been verified.

## Health Checks

- `/api/health/live` checks that the Next.js process can answer HTTP requests.
- `/api/health/ready` checks PostgreSQL and the configured public webroot and is the endpoint used by the Docker healthcheck.
- `/api/health` remains a liveness alias, and `/health` remains a readiness alias for older monitors.

Images are published by GitHub Actions to:

```text
ghcr.io/asetho/surls:latest
```

## Admin Click Tracking

Authenticated admin redirects are ignored by default. When “Track admin clicks” is disabled, Surls does not store a click event and does not increment totals, unique visit counts, top-link rankings, recent activity, referrer stats, browser/device stats, or location stats. Admin redirects include `X-ShortURL-Admin-Click: ignored` when a click is skipped.

Enable the setting only when you explicitly want admin tests to affect statistics.

Redirect responses use no-store cache headers because links can be edited, disabled, archived, expired, or click-limited. If a visitor sends `DNT: 1` or `Sec-GPC: 1`, Surls still redirects them but skips detailed click analytics for that request; aggregate counters may still update so click-limited links keep working. Surls also caps analytics writes for high-volume click bursts per link and visitor source; rate-limited visitors still redirect normally.

## Theme Modes

The admin sidebar footer includes Light, Dark, and Auto controls; the included public homepage has its own theme controls. The admin choice is saved in `localStorage` and a first-party `surls-theme` cookie so server-rendered pages can use the same choice. Auto follows `prefers-color-scheme`.

Site admins can change the default light/dark palettes from **Settings → Dashboard theme → Open Theme Editor**, preview changes, import/export a theme, or reset to the built-in palette. Custom login templates can supply their own colors through the login CSS hooks described above.

## 2FA And Backup Codes

Open **Profile → Security** (`/admin/profile`) to start TOTP setup. Scan the QR code or enter the manual key, then submit a current code to enable 2FA. Backup codes can be regenerated from the same page. They are shown only after regeneration and stored only as one-way hashes.

## Passkeys

Open **Profile → Security** to register and remove WebAuthn passkeys. Registration and sign-in require local user verification, such as Face ID, Touch ID, Windows Hello, or a security-key PIN; a touch-only key is insufficient. The login page can then use a registered resident passkey for passwordless sign-in.

Set these values for the public HTTPS origin before using passkeys in production:

```env
WEBAUTHN_RP_ID="your.domain"
WEBAUTHN_ORIGIN="https://your.domain"
```

## API

Create an API token in **Tools → Tokens** (`/admin/tools`).

Create a short URL:

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer surls_..." \
  -H "Content-Type: application/json" \
  -d '{"destinationUrl":"https://example.com","code":"example","title":"Example"}'
```

Upload a file and create its short URL:

```bash
curl -X POST http://localhost:3000/api/uploads \
  -H "Authorization: Bearer surls_..." \
  -F "file=@./document.pdf" \
  -F "filenameMode=safe"
```

API token hashes are stored in the database. The plain token is shown once.
New tokens are limited to link and upload creation. **Tools → Tokens** offers 30, 90, 180, or 365 days, or **Forever**, with 90 days selected initially. `API_TOKEN_DAYS` is the server fallback when no supported selection is supplied. Tokens can be rolled, revoked, or deleted. Rolling replaces the token and invalidates the old value, so update each client using it. Existing tokens keep their original scopes; generate a new token for the macOS Share extension.

## Import And Export

- Links CSV export: **Tools → Import/export**. JSON export requires a site admin.
- Per-link stats CSV export: link details page.
- CSV import accepts rows in this shape:

  ```csv
  https://example.com,custom-alias,Optional title
  ```

Leave “Confirm import” unchecked to preview validation without creating links. Quoted fields, commas inside quotes, and escaped double quotes are supported.

### YOURLS import

Use the YOURLS importer when migrating an existing YOURLS database and preserving click history.
Export the YOURLS `yourls_url` table with at least:

```csv
keyword,url,title,timestamp,clicks
```

Export the YOURLS `yourls_log` table with at least:

```csv
click_id,click_time,shorturl,referrer,user_agent,ip_address,country_code
```

Preview the import first:

```bash
npm run import:yourls -- --urls ./yourls_url.csv --logs ./yourls_log.csv --dry-run
```

Then import:

```bash
npm run import:yourls -- --urls ./yourls_url.csv --logs ./yourls_log.csv --created-by-email admin@example.com --confirm
```

By default, imported YOURLS click events replace existing click events for the imported short codes.
Use `--append-clicks` to append instead. Raw imported IP addresses are not stored unless `--store-raw-ip` is passed;
hashed IP and visitor values are still populated for statistics.

## Security Notes

- Destination URLs must be absolute HTTP/HTTPS URLs.
- `javascript:`, `data:`, `file:`, localhost, `.local`, private IP ranges, and metadata/internal destinations are blocked by default.
- Server-side link checks resolve DNS and reject private/internal addresses before fetching.
- Before redirecting, Surls re-resolves non-upload destinations and blocks private/internal answers by default. This is a best-effort safeguard: browser or split-horizon DNS, rebinding after the server check, and downstream browser redirects can still resolve differently. `ALLOW_PRIVATE_DESTINATIONS=true` intentionally permits private answers, and exact same-origin uploaded-file links are exempt.
- Admin forms are CSRF protected.
- Sessions use HttpOnly cookies, `SameSite=Lax`, and secure cookies in production.
- Passwords and backup codes use one-way Argon2id hashes.
- TOTP secrets are encrypted with `AUTH_SECRET`.
- Raw IPs are purged after 30 days; click-event rows and audit logs use configurable retention windows.
- Do not commit real secrets.

## Session locations

With `TRUST_PROXY=true`, Profile shows approximate city, state/region, and country values supplied by a trusted proxy, for example **Philadelphia, Pennsylvania, United States**. Missing fields are omitted. For Cloudflare, enable [Add visitor location headers](https://developers.cloudflare.com/rules/transform/managed-transforms/reference/#add-visitor-location-headers) and forward `CF-IPCity`, `CF-Region` (or `CF-Region-Code`), and `CF-IPCountry` to Surls. Cloudflare's Network → IP Geolocation option alone supplies only the country. A proxy using a local GeoIP database can supply `X-Geo-City`, `X-Geo-Region`, and `X-Geo-Country` instead. IP-based locations may describe an ISP or VPN exit point rather than the device's actual location.

The proxy must overwrite client IP headers and strip caller-supplied location headers, accepting Cloudflare headers only from verified Cloudflare traffic. Private, loopback, link-local, and Tailscale addresses in the trusted client IP header show **Local network**. Session locations refresh when that session is used; existing sessions gain city information on their next authenticated visit if the proxy supplies it. Inactive sessions keep their previously stored location. Surls stores only city, region, country, and a local-network flag, never the raw session address or precise coordinates. Missing trustworthy location data remains **Unavailable**.

## Production Checklist

- Use a strong `AUTH_SECRET`.
- Set a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` before building production images and pass it as the `next_server_actions_encryption_key` BuildKit secret.
- Set `BASE_URL` to the public HTTPS origin.
- Set `NODE_ENV=production`.
- Run behind HTTPS and keep HSTS enabled.
- Keep `TRUST_PROXY=false` unless Surls is reachable only through a trusted reverse proxy that overwrites `X-Forwarded-For` and related geo headers.
- Rotate default database credentials.
- Keep automatic migrations enabled unless your deployment system runs them separately.
- Create the first admin with temporary `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`, then remove `INITIAL_ADMIN_PASSWORD` after first login.
- Enable TOTP and generate backup codes.
- Review `API_TOKEN_DAYS`, `CLICK_EVENT_RETENTION_DAYS`, and `AUDIT_LOG_RETENTION_DAYS` for your retention policy.
- Run database migrations before scaling to multiple app replicas; login, passkey, page-title, and API creation rate limits are shared through PostgreSQL.
- Mount the public webroot read-only and keep write access limited to trusted admins.
- Keep `ALLOW_PRIVATE_DESTINATIONS=false` unless you understand the SSRF risk.
- Put PostgreSQL backups in place.
- Review `npm audit` after each dependency update.

## Development Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run prisma:migrate
npm run prisma:deploy
node --env-file=.env --run setup:admin
```

## Documentation and previews

Repository screenshots are kept in [`docs/screenshots/`](docs/screenshots/README.md). `visual-audit-preview/` is an ignored local workspace for the historical CSS audit, not an application dependency or a shipped preview. The [archived audit](docs/audits/css-visual-audit.md) records its original scope; it is not a current list of product defects.
