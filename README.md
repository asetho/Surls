# Surls

Surls is a personal short URL system for managing private links, redirects, and click statistics.

It is inspired by the product shape of personal URL shorteners such as YOURLS and Tiny.cc, but the code, branding, UI, and implementation are original to this project.

## What It Includes

- Minimal public Surls home page with no public registration.
- Secure admin login with Argon2id password hashing, HttpOnly sessions, CSRF-protected admin forms, and login rate limiting.
- TOTP 2FA setup with QR/manual key verification.
- One-time backup codes stored only as hashes.
- Admin dashboard with totals, recent activity, top links, and attention states.
- Link management with generated or custom aliases, safe destination validation, tags, notes, expiration, max-click limits, enable/disable, archive, QR codes, copy/share buttons, and CSV stats export.
- Redirects at `/:code` and `/s/:code`.
- Admin clicks excluded from statistics by default, controlled by the Settings page switch “Track admin clicks”.
- Privacy-respecting click stats: timestamp, referrer, user-agent-derived browser/device, hashed IP-derived values, and no raw IP storage.
- Cookie consent banner plus `/privacy` and `/cookies` notices.
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
openssl rand -hex 24
openssl rand -base64 32
docker compose up --build
```

The container runs Prisma migrations and seeds missing settings on startup. To create the first admin automatically, set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` before first boot. After the first login, remove `INITIAL_ADMIN_PASSWORD` from `.env` and recreate the app container.

Change `AUTH_SECRET`, database credentials, `BASE_URL`, and WebAuthn values before production. Use a URL-safe PostgreSQL password, such as `openssl rand -hex 24`, because the compose file embeds it in `DATABASE_URL`.

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
- creates missing default settings and optionally the first admin unless `SURLS_RUN_BOOTSTRAP=false`;
- starts the Next.js standalone server.

Images are published by GitHub Actions to:

```text
ghcr.io/aaronwhippo/surls:latest
```

## Admin Click Tracking

Authenticated admin redirects are ignored by default. When “Track admin clicks” is disabled, Surls does not store a click event and does not increment totals, unique-ish counts, top-link rankings, recent activity, referrer stats, browser/device stats, or location stats. Admin redirects include `X-ShortURL-Admin-Click: ignored` when a click is skipped.

Enable the setting only when you explicitly want admin tests to affect statistics.

## Theme Modes

The header and admin toolbar include Light, Dark, and Auto controls. The choice is stored in the browser with `localStorage`. Auto follows `prefers-color-scheme`.

## 2FA And Backup Codes

Open `Admin -> Security` to start TOTP setup. Scan the QR code or enter the manual key, then submit a current code to enable 2FA. Backup codes can be regenerated from the same page. They are shown only after regeneration and stored only as one-way hashes.

## Passkeys

The database schema includes passkey/WebAuthn credential storage fields. Full browser registration and login endpoints are not wired in this initial implementation. To finish passkeys, add registration/authentication challenge routes using `@simplewebauthn/server`, store only public credential data, and set:

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
- Do not commit real secrets.

## Production Checklist

- Use a strong `AUTH_SECRET`.
- Set `BASE_URL` to the public HTTPS origin.
- Set `NODE_ENV=production`.
- Run behind HTTPS and keep HSTS enabled.
- Rotate default database credentials.
- Keep automatic migrations enabled unless your deployment system runs them separately.
- Create the first admin with temporary `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`, then remove `INITIAL_ADMIN_PASSWORD` after first login.
- Enable TOTP and generate backup codes.
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

- Complete WebAuthn/passkey registration and login.
- Add database-backed integration tests against a disposable PostgreSQL container.
- Add geolocation only if needed, and keep it approximate.
- Add password-protected public-link challenge pages.
- Expand CSV parsing to support quoted commas and richer preview tables.
