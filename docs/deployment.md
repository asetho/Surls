# Install and operate Surls

Use the repository's root [`docker-compose.yml`](../docker-compose.yml) with Docker Compose v2. It runs Surls and PostgreSQL 18, persists the database in a named volume, and mounts separate host directories for public pages and uploaded files. A reverse proxy is optional for localhost testing and required for a public HTTPS deployment.

## 1. Prepare the installation

```bash
git clone https://github.com/asetho/Surls.git
cd Surls
cp .env.example .env
mkdir -p www uploads
```

Edit `.env` before starting. Generate three independent values and paste each output into its named field:

```bash
openssl rand -hex 24    # POSTGRES_PASSWORD
openssl rand -base64 32 # AUTH_SECRET
openssl rand -base64 32 # NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
```

Use a hex database password because Compose inserts it into a connection URL. Keep both application keys stable across deployments. `AUTH_SECRET` protects encrypted TOTP secrets and provider credentials as well as authentication state; replacing it can make saved credentials unusable. The Server Actions key allows already-loaded forms to survive rebuilds. Store `.env` securely and include it in encrypted backups.

| Setting | Value or purpose |
| --- | --- |
| `SURLS_IMAGE` | A published tag, for example `ghcr.io/asetho/surls:1.15.0`. `latest` tracks new releases. |
| `POSTGRES_USER`, `POSTGRES_DB` | Defaults are `surls`. |
| `POSTGRES_PASSWORD` | Generated hex password from above. |
| `AUTH_SECRET` | Generated random value; production rejects empty or placeholder values. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Generated base64 key, passed through the Compose secret at build and runtime. |
| `BASE_URL` | Exact public origin, for example `https://links.example.com`, with no trailing slash. |
| `WEBAUTHN_RP_ID` | Hostname only, for example `links.example.com`. |
| `WEBAUTHN_ORIGIN` | Same HTTPS origin as `BASE_URL`. |
| `SURLS_PORT` | Published app port. Use `127.0.0.1:3000` for a proxy on the same host, or `3000` for access on all host interfaces. |
| `SURLS_PUBLIC_WEBROOT_PATH` | Existing directory, default `./www`; read-only inside the app at `/app/www`. An empty directory uses the included homepage. |
| `SURLS_UPLOADS_PATH` | Existing writable directory, default `./uploads`; mounted at `/app/uploads`. |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD` | First admin account; password must contain at least 12 characters. |
| `TRUST_PROXY` | Default `false`; enable only with the trusted-proxy boundary described below. |

For a localhost-only installation, the example `BASE_URL`, `WEBAUTHN_RP_ID`, and `WEBAUTHN_ORIGIN` values can stay at `http://localhost:3000`, `localhost`, and `http://localhost:3000`. Production external sign-in requires HTTPS.

The app runs as UID/GID `1000:1000`. On a Linux Docker host, give that user write access to the uploads directory:

```bash
sudo chown 1000:1000 uploads
```

For an existing uploads directory, apply appropriate ownership to its existing contents too. The webroot needs traverse/read permissions, not application write access. Both directories must exist: the bind mounts deliberately use `create_host_path: false`.

`DATABASE_URL` in `.env` is used by host-run development commands. Compose supplies the app's container connection URL using the `POSTGRES_*` values and the internal `db:5432` address. PostgreSQL is not published to the host by the root Compose file.

## 2. Start Surls

### Use a published image

If GHCR reports an access error, authenticate to `ghcr.io` with an account that can read the package. Use Docker's password prompt or `--password-stdin`; do not put a token in shell history.

```bash
docker compose pull
docker compose up -d --no-build
docker compose ps
docker compose logs --tail=100 app
```

### Build from source

The same Compose file can build the checked-out source using the key already configured in `.env`:

```bash
docker compose build app
docker compose up -d --no-build
```

The image uses Next.js standalone output and starts through `scripts/docker-entrypoint.mjs`. Startup applies Prisma migrations, creates missing default settings, optionally creates the first admin, and purges expired analytics/audit data. `SURLS_RUN_MIGRATIONS=false` and `SURLS_RUN_BOOTSTRAP=false` are available for deployments that deliberately run those steps separately. Keep the defaults for a single-instance setup.

Open `/admin` and sign in. After the first successful login, remove `INITIAL_ADMIN_PASSWORD` from `.env` and recreate the app to remove it from the container environment:

```bash
docker compose up -d --no-deps --force-recreate app
```

There is no built-in shared admin password. The initial-admin bootstrap does not overwrite an existing account's password.

## 3. Configure HTTPS and sign-in

Point the site's DNS record at your proxy, terminate TLS there, and forward requests to Surls on port 3000. Preserve the public host and scheme. Restrict direct access to the app's published port when using a trusted proxy; the default `3000:3000` mapping listens on all host interfaces.

Keep `TRUST_PROXY=false` unless every request to Surls passes through a proxy you control. With it enabled, the proxy must overwrite incoming client-IP headers, strip untrusted location headers, and forward the real client address. See [session location configuration](../README.md#session-locations) for Cloudflare or local GeoIP headers.

For optional Turnstile protection, set **both** `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Both blank disables Turnstile; configuring only one causes startup to fail.

Then configure:

- **Profile → Security:** passkeys, TOTP, and backup codes.
- **Settings → Sign-in methods:** optional [external providers and account linking](external-sign-in.md). Test an admin connection before disabling password/passkey login.
- **Settings:** site name, theme, favicons, custom pages, upload limits, and click-tracking preferences.
- **Tools → Tokens:** separate API tokens for each integration; each new token is displayed only once.

Keep `SURLS_LOGIN_DEV_ENABLED=false` on public deployments. The `/login-dev` comparison page is an admin-only development preview.

## Health and troubleshooting

| Endpoint | Checks |
| --- | --- |
| `/api/health/live` | The application process can respond. |
| `/api/health/ready` | Database access and the configured public webroot; used by Docker's healthcheck. |
| `/api/health`, `/health` | Compatibility aliases for liveness and readiness, respectively. |

For an unhealthy app or proxy 502, inspect `docker compose ps` and the app logs first. Common causes are an incomplete database migration, missing mount directories, unreadable webroot files, an unwritable uploads directory, or invalid environment values. A Prisma P3015 error means a migration directory is missing its `migration.sql`; deploy a complete source/image rather than deleting migration history.

Readiness does not validate every custom asset or `login.html`. Open the homepage, login, and representative file links after a change. See [public webroot behavior](../README.md#public-webroot) for reserved paths and custom-login placeholders.

## Upgrades

1. Read the target release notes and back up the database, uploaded files, custom webroot, and `.env` before changing images or applying migrations.
2. Set `SURLS_IMAGE` to the desired version tag in `.env` (or check out the desired source release for a local build).
3. Pull and recreate the app:

   ```bash
   docker compose pull app
   docker compose up -d --no-deps --no-build app
   docker compose ps
   docker compose logs --tail=100 app
   ```

   For a source build, replace `pull app` with `build app`.
4. Confirm readiness, sign-in, redirects, and uploaded-file links. Preserve `AUTH_SECRET`, the Server Actions key, the database volume, and both host paths.

Migrations run at startup. Reverting the image alone may not reverse a schema change; use the matching database backup when a downgrade requires it. Coordinate migrations before starting multiple app replicas.

Do not run `docker compose down -v` during normal updates: it removes the managed database volume. If renaming a Compose project, use [`docker-compose.stack.yml`](../docker-compose.stack.yml) with `SURLS_POSTGRES_VOLUME_NAME` set to the **existing** volume name; changing project names without preserving the volume can appear to create an empty installation.

## Backups and restoration

Keep backups outside the public webroot and uploads directory. A database-only backup does not include uploaded file bytes or filesystem custom pages.

Example PostgreSQL logical backup, saved in a private directory outside this checkout:

```bash
install -d -m 700 ../surls-backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ../surls-backups/surls.dump
```

Also back up the directory specified by `SURLS_UPLOADS_PATH`, the webroot specified by `SURLS_PUBLIC_WEBROOT_PATH`, and `.env` including the stable keys. Settings, provider credentials, uploaded page templates, and managed favicons reside in PostgreSQL. For a consistent file/database snapshot, stop application writes while taking the database and filesystem backups, then resume the app.

Restore into a separate, empty PostgreSQL database first, using a compatible PostgreSQL version and `pg_restore`, restore the matching host directories and keys, and verify the result before pointing the proxy at it. A restore test should include sign-in, a short-link redirect, a downloaded upload, and custom-page rendering.

## Storage and retention

- Upload request ceiling: **25 MiB**. `UPLOAD_MAX_BYTES` can lower it.
- Default storage quotas: **1 GiB per user**, **10 GiB per site**; configure `UPLOAD_USER_STORAGE_QUOTA_BYTES` and `UPLOAD_SITE_STORAGE_QUOTA_BYTES`.
- Raw click IPs: purged after **30 days**.
- Click events and audit logs: **365 days** by default via `CLICK_EVENT_RETENTION_DAYS` and `AUDIT_LOG_RETENTION_DAYS`.
- Sessions: **14 days** by default via `SESSION_DAYS`.

Uploaded bytes are served through managed short links, not a public `/uploads/` directory. Never use the public webroot as a backup or secret-storage folder.
