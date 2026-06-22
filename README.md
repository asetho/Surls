# Surls

Surls is a short URL system for managing short links, redirects, and click statistics.

It is inspired by the product shape of URL shorteners such as YOURLS and Tiny.cc, but the code, branding, UI, and implementation are original to this project.

## What It Includes

- Mounted public webroot for owner-controlled static files, with no built-in public marketing pages.
- Secure admin login with Argon2id password hashing, HttpOnly sessions, CSRF-protected admin forms, login rate limiting, TOTP, backup codes, and passkey sign-in.
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
- Prisma PostgreSQL schema and initial migration.
- Dockerfile, production entrypoint, `docker-compose.yml`, and 1Panel deployment files.
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

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment defaults:

   ```bash
   cp .env.example .env
   ```

3. Set at least:

   ```env
   DATABASE_URL="postgresql://surls:surls@localhost:5432/surls?schema=public"
   BASE_URL="http://localhost:3000"
   AUTH_SECRET="replace-with-at-least-32-random-bytes"
   ```

4. Start PostgreSQL, for example:

   ```bash
   docker compose up -d db
   ```

5. Apply migrations and seed settings:

   ```bash
   npm run prisma:deploy
   npm run seed
   ```

6. Create the first admin:

   ```bash
   npm run setup:admin
   ```

7. Run Surls:

   ```bash
   npm run dev
   ```

## Docker Compose

For a local containerized run, copy the environment template and set at least `POSTGRES_PASSWORD` and `AUTH_SECRET`:

```bash
cp .env.example .env
openssl rand -hex 24 # POSTGRES_PASSWORD
openssl rand -base64 32 # AUTH_SECRET
openssl rand -base64 32 # NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
docker compose up --build
```

The container runs Prisma migrations, seeds missing settings, and purges expired raw IP addresses, click events, and audit logs on startup. To create the first admin automatically, set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` before first boot. After the first login, remove `INITIAL_ADMIN_PASSWORD` from `.env` and recreate the app container.

Change `AUTH_SECRET`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, database credentials, `BASE_URL`, and WebAuthn values before production. Generate `AUTH_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` with a high-entropy command such as `openssl rand -base64 32`; production startup rejects documented placeholder values for `AUTH_SECRET`. Keep `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across rebuilds so self-hosted Server Action forms from an already-loaded page do not fail after a deploy. Use a URL-safe PostgreSQL password, such as `openssl rand -hex 24`, because the compose file embeds it in `DATABASE_URL`.

## 1Panel Install

Use the production compose files in `deploy/1panel`:

```bash
cp deploy/1panel/.env.example deploy/1panel/.env
```

Edit `deploy/1panel/.env`, then create a 1Panel Compose project from:

```text
/opt/surls/deploy/1panel/compose.yml
```

See `deploy/1panel/README.md` for the exact 1Panel steps, including the reverse proxy and first-admin cleanup.

## Docker Image

Build a production image locally:

```bash
docker build -t surls:latest .
```

Run the image against a PostgreSQL database:

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://surls:surls@host.docker.internal:5432/surls?schema=public" \
  -e BASE_URL="http://localhost:3000" \
  -e AUTH_SECRET="replace-with-at-least-32-random-bytes" \
  surls:latest
```

The Docker build uses Next.js standalone output and a `.dockerignore` file to keep the runtime image focused on production server files.

The production image starts through `scripts/docker-entrypoint.mjs`, which:

- checks required production environment values;
- runs `prisma migrate deploy` unless `SURLS_RUN_MIGRATIONS=false`;
- creates missing default settings, optionally creates the first admin, and purges expired raw IP addresses, click events, and audit logs unless `SURLS_RUN_BOOTSTRAP=false`;
- starts the Next.js standalone server.

## Public Webroot

The public side of Surls is served from a read-only mounted webroot. In Docker Compose, set `SURLS_PUBLIC_WEBROOT_PATH` to the host directory you want to use; the container reads it at `/app/www`.

```env
SURLS_PUBLIC_WEBROOT_PATH="./www"
```

Create that host directory before starting Docker. The compose bind mount uses `create_host_path: false`, so Docker will fail fast instead of silently creating a default directory in the wrong place.

If you set `PUBLIC_WEBROOT_DIR` or `CUSTOM_PAGES_DIR` directly without Docker Compose, use an absolute path.

Public file behavior:

- `/` serves `index.html` when present.
- Missing public paths and missing short links serve `404.html` with HTTP 404 when present.
- Other files and directories are served directly, such as `/test.html`, `/assets/site.css`, or `/docs/index.html`.
- Exact public files win before short-link redirects, so `/test.html` serves the file if it exists; otherwise one-segment paths can still resolve as short links.
- App-owned paths such as `/admin`, `/api`, `/_next`, `/health`, and `/s/:code` remain reserved.

`login.html` in the webroot is reserved for the app-owned admin login template and is not served as a public file. It must include exactly one `{{LOGIN_FORM}}` placeholder where the secure Surls login form should appear. You can also place optional `{{LOGIN_TITLE}}` and `{{LOGIN_TAGLINE}}` placeholders anywhere in the template; Surls replaces them with the current login-step heading text. The inserted form exposes stable styling hooks such as `[data-surls-auth-form]`, `[data-surls-auth-input]`, `[data-surls-auth-submit]`, `[data-surls-auth-secondary]`, and `[data-surls-auth-passkey]`, plus CSS variables like `--surls-login-input-background` and `--surls-login-button-background`.

Admin-managed favicons can be uploaded from Settings without writing to the read-only webroot. Uploaded favicons are served from standard root URLs that custom pages can reference directly: `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, and `/site.webmanifest`. If no admin-managed favicon package is configured, these paths fall back to matching files in the public webroot when present.

Public webroot HTML is served as same-origin trusted owner content. Keep this directory writable only by trusted admins. If you want stronger isolation for arbitrary third-party HTML, serve that content from a separate domain.

## Health Checks

- `/api/health/live` checks that the Next.js process can answer HTTP requests.
- `/api/health/ready` checks that the app can reach PostgreSQL and is the endpoint used by Docker and 1Panel healthchecks.
- `/api/health` remains a liveness alias, and `/health` remains a readiness alias for older monitors.

Images are published by GitHub Actions to:

```text
ghcr.io/aaronwhippo/surls:latest
```

## Admin Click Tracking

Authenticated admin redirects are ignored by default. When “Track admin clicks” is disabled, Surls does not store a click event and does not increment totals, unique visit counts, top-link rankings, recent activity, referrer stats, browser/device stats, or location stats. Admin redirects include `X-ShortURL-Admin-Click: ignored` when a click is skipped.

Enable the setting only when you explicitly want admin tests to affect statistics.

Redirect responses use no-store cache headers because links can be edited, disabled, archived, expired, or click-limited. If a visitor sends `DNT: 1` or `Sec-GPC: 1`, Surls still redirects them but skips detailed click analytics for that request; aggregate counters may still update so click-limited links keep working. Surls also caps analytics writes for high-volume click bursts per link and visitor source; rate-limited visitors still redirect normally.

## Theme Modes

The header and admin toolbar include Light, Dark, and Auto controls. The choice is stored in the browser with `localStorage`. Auto follows `prefers-color-scheme`.

## 2FA And Backup Codes

Open `Admin -> Security` to start TOTP setup. Scan the QR code or enter the manual key, then submit a current code to enable 2FA. Backup codes can be regenerated from the same page. They are shown only after regeneration and stored only as one-way hashes.

## Passkeys

Open `Admin -> Security` to register and remove WebAuthn passkeys. Registration requires a signed-in account and local user verification such as Face ID, Touch ID, Windows Hello, a PIN, or a security key gesture. The login page can then use a registered resident passkey for passwordless sign-in.

Set these values for the public HTTPS origin before using passkeys in production:

```env
WEBAUTHN_RP_ID="your.domain"
WEBAUTHN_ORIGIN="https://your.domain"
```

## API

Create an API token in `Admin -> Tools`.

Create a short URL:

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer surls_..." \
  -H "Content-Type: application/json" \
  -d '{"destinationUrl":"https://example.com","code":"example","title":"Example"}'
```

API token hashes are stored in the database. The plain token is shown once.
Tokens are limited to link creation by default, expire after `API_TOKEN_DAYS` unless a shorter supported lifetime is selected, and can be revoked from `Admin -> Tools`.

## Import And Export

- Links CSV/JSON export: `Admin -> Tools`.
- Per-link stats CSV export: link details page.
- CSV import accepts rows in this shape:

  ```csv
  https://example.com,custom-alias,Optional title
  ```

Leave “Confirm import” unchecked to preview validation without creating links.

## Security Notes

- Destination URLs must be absolute HTTP/HTTPS URLs.
- `javascript:`, `data:`, `file:`, localhost, `.local`, private IP ranges, and metadata/internal destinations are blocked by default.
- Server-side link checks resolve DNS and reject private/internal addresses before fetching.
- Admin forms are CSRF protected.
- Sessions use HttpOnly cookies, `SameSite=Lax`, and secure cookies in production.
- Passwords and backup codes use one-way Argon2id hashes.
- TOTP secrets are encrypted with `AUTH_SECRET`.
- Raw IPs are purged after 30 days; click-event rows and audit logs use configurable retention windows.
- Do not commit real secrets.

## Production Checklist

- Use a strong `AUTH_SECRET`.
- Set a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` before building production images.
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
npm run setup:admin
```

## Current Known Follow-Ups

- Add database-backed integration tests against a disposable PostgreSQL container.
- Add geolocation only if needed, and keep it approximate.
- Add password-protected public-link challenge pages.
- Expand CSV parsing to support quoted commas and richer preview tables.
