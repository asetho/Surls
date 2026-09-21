# Surls On 1Panel

This folder contains the easiest production-style 1Panel install path. It uses the prebuilt GitHub Container Registry image, PostgreSQL, automatic Prisma migrations, and first-admin bootstrap.

## 1. Put These Files On The Server

Clone the repo somewhere 1Panel can read, for example:

```bash
sudo mkdir -p /opt/surls
sudo chown "$USER:$USER" /opt/surls
git clone git@github.com:asetho/Surls.git /opt/surls
cd /opt/surls
cp deploy/1panel/.env.example deploy/1panel/.env
```

## 2. Fill In Production Values

Edit `deploy/1panel/.env`.

Generate safe values with:

```bash
openssl rand -hex 24 # POSTGRES_PASSWORD
openssl rand -base64 32 # AUTH_SECRET
openssl rand -base64 32 # NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
```

Set at least:

```env
POSTGRES_PASSWORD=<hex password>
BASE_URL=https://s.yourdomain.com
AUTH_SECRET=<base64 secret>
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<base64 server actions key>
WEBAUTHN_RP_ID=s.yourdomain.com
WEBAUTHN_ORIGIN=https://s.yourdomain.com
SURLS_PUBLIC_WEBROOT_PATH=/opt/surls/www
SURLS_UPLOADS_PATH=/opt/surls/uploads
INITIAL_ADMIN_EMAIL=you@example.com
INITIAL_ADMIN_PASSWORD=<temporary 12+ character password>
```

Use only URL-safe characters in `POSTGRES_PASSWORD`, such as the hex output above, because it is embedded in `DATABASE_URL`.

## 3. Create The Compose Project In 1Panel

In 1Panel:

1. Open `Container -> Composes`.
2. Click `Create`.
3. Choose `Path selection`.
4. Select `/opt/surls/deploy/1panel/compose.yml`.
5. Name the project `surls`.
6. Start it.

The compose file can build the Surls image from the cloned repo. It passes `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to that build and running container as a Compose secret, so the key is not recorded in image build arguments or environment metadata. It also has an `SURLS_IMAGE` setting, so after GitHub Actions publishes a GHCR image you can pull the prebuilt image instead. If the GHCR package is private, log in to GHCR from the server or keep using the local build path.

The first app boot runs migrations, creates missing app settings, purges expired raw IP addresses, click events, and audit logs, and creates the initial admin if no users exist. Set `AUTH_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to high-entropy values such as output from `openssl rand -base64 32`; placeholder values are rejected in production for `AUTH_SECRET`. Keep `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable across rebuilds so self-hosted Server Action forms from an already-loaded page do not fail after a deploy.

The app container healthcheck uses `/api/health/ready`, which verifies both the Surls process and PostgreSQL access.

Keep `TRUST_PROXY=false` unless the app container is reachable only through a trusted reverse proxy that overwrites `X-Forwarded-For` and related geo headers.

## Public Webroot

The compose file mounts `SURLS_PUBLIC_WEBROOT_PATH` into the app container read-only. Choose the host path you want, set it in `deploy/1panel/.env`, and create it before starting the compose project:

```bash
mkdir -p /opt/surls/www
```

Put public files in that host directory:

- `/` serves `index.html` when present.
- Missing public paths and missing short links serve `404.html` with HTTP 404 when present.
- Other files and directories are served directly, such as `/test.html`, `/assets/site.css`, or `/docs/index.html`.
- Exact public files win before short-link redirects, while app-owned paths such as `/admin`, `/api`, `/_next`, `/health`, and `/s/:code` remain reserved.

The bind mount uses `create_host_path: false`, so Docker fails fast if the configured directory does not exist instead of auto-creating `/opt/surls/www` or another unintended path.

If you set `PUBLIC_WEBROOT_DIR` or `CUSTOM_PAGES_DIR` directly without Docker Compose, use an absolute path.

`login.html` in this directory is reserved for the app-owned admin login template and is not served as a public file. It must include exactly one `{{LOGIN_FORM}}` placeholder where the secure Surls login form should appear. You can also place optional `{{LOGIN_TITLE}}` and `{{LOGIN_TAGLINE}}` placeholders anywhere in the template; Surls replaces them with the current login-step heading text. The inserted form exposes stable styling hooks such as `[data-surls-auth-form]`, `[data-surls-auth-input]`, `[data-surls-auth-submit]`, `[data-surls-auth-secondary]`, and `[data-surls-auth-passkey]`, plus CSS variables like `--surls-login-input-background` and `--surls-login-button-background`.

Public webroot HTML is served as same-origin trusted owner content. Keep this directory writable only by trusted admins. File contents are read at request time, so normal HTML changes do not require a container rebuild.

## Uploaded Files

The Tools page includes Upload & Shorten for admin-uploaded files. Files are served from `/uploads/:filename`. Set `SURLS_UPLOADS_PATH` to the host directory that should hold them; the compose file bind-mounts that directory at `/app/uploads`.

Create the directory before starting or recreating the app:

```bash
mkdir -p /opt/surls/uploads
chown -R 1000:1000 /opt/surls/uploads
```

Use a different directory for every Surls instance. For example, the two `mn` stacks can use `/opt/surls-asetho/uploads` for asetho.link and `/opt/surls-aswonl/uploads` for asw.onl.

The app runs as the unprivileged container user `1000:1000`, so existing installations must also update the upload directory ownership before recreating the app container. The bind mount uses `create_host_path: false`, so Docker fails fast if the path is missing. Set `UPLOAD_MAX_BYTES` in `.env` to lower the process-safe 25 MB limit. New uploads default to a 1 GiB per-user storage quota and a 10 GiB site storage quota; override `UPLOAD_USER_STORAGE_QUOTA_BYTES` and `UPLOAD_SITE_STORAGE_QUOTA_BYTES` when needed.

The repository's `npm run deploy:hmserv` workflow performs the same ownership update through the newly built app image before restarting the container.

To migrate an installation that still uses the former named volume, stop writes to the app, create the host directory, and copy the volume contents before recreating the app. Replace the example volume name if the Compose project has a different name:

```bash
docker run --rm \
  --mount type=volume,src=surls_surls-uploads,dst=/from,readonly \
  --mount type=bind,src=/opt/surls/uploads,dst=/to \
  alpine sh -c 'cp -a /from/. /to/'
```

Verify the files through the application before removing the old Docker volume. Keeping it temporarily provides a rollback copy.

## 4. Add HTTPS

Create a reverse proxy website in 1Panel:

```text
Primary domain: s.yourdomain.com
Proxy address: http://127.0.0.1:3000
Enable HTTPS: yes
```

Make sure `BASE_URL` and `WEBAUTHN_ORIGIN` match the HTTPS domain exactly.

## 5. Clean Up Initial Credentials

After you can log in:

1. Clear `INITIAL_ADMIN_PASSWORD` in `deploy/1panel/.env`.
2. Redeploy or recreate the Surls app container from 1Panel.
3. Enable TOTP in `Admin -> Security`.

## Updating

If you use the prebuilt image:

1. Pull the latest image from 1Panel or run `docker compose pull`.
2. Recreate the app container.

If you build locally from the repo:

1. Run `git pull` in `/opt/surls`.
2. Rebuild/recreate the Compose project in 1Panel.

Migrations run automatically by default. Back up PostgreSQL before upgrading a real instance.
