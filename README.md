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
- Dockerfile and `docker-compose.yml`.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- PostgreSQL
- Prisma 6
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

For a local containerized run:

```bash
docker compose up --build
docker compose exec app npm run prisma:deploy
docker compose exec app npm run setup:admin
```

Change `AUTH_SECRET`, database credentials, `BASE_URL`, and WebAuthn values before production.

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
- Run `npm run prisma:deploy` during deployment.
- Create the first admin through a secure shell.
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
