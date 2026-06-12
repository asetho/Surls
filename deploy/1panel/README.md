# Surls On 1Panel

This folder contains the easiest production-style 1Panel install path. It uses the prebuilt GitHub Container Registry image, PostgreSQL, automatic Prisma migrations, and first-admin bootstrap.

## 1. Put These Files On The Server

Clone the repo somewhere 1Panel can read, for example:

```bash
sudo mkdir -p /opt/surls
sudo chown "$USER:$USER" /opt/surls
git clone git@github.com:aaronwhippo/Surls.git /opt/surls
cd /opt/surls
cp deploy/1panel/.env.example deploy/1panel/.env
```

## 2. Fill In Production Values

Edit `deploy/1panel/.env`.

Generate safe values with:

```bash
openssl rand -hex 24
openssl rand -base64 32
```

Set at least:

```env
POSTGRES_PASSWORD=<hex password>
BASE_URL=https://s.yourdomain.com
AUTH_SECRET=<base64 secret>
WEBAUTHN_RP_ID=s.yourdomain.com
WEBAUTHN_ORIGIN=https://s.yourdomain.com
SURLS_CUSTOM_PAGES_PATH=/opt/surls/custom-pages
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

The compose file can build the Surls image from the cloned repo. It also has an `SURLS_IMAGE` setting, so after GitHub Actions publishes a GHCR image you can pull the prebuilt image instead. If the GHCR package is private, log in to GHCR from the server or keep using the local build path.

The first app boot runs migrations, creates missing app settings, purges raw IP addresses older than 30 days, and creates the initial admin if no users exist. Set `AUTH_SECRET` to a high-entropy value such as output from `openssl rand -base64 32`; placeholder values are rejected in production.

The app container healthcheck uses `/api/health/ready`, which verifies both the Surls process and PostgreSQL access.

Keep `TRUST_PROXY=false` unless the app container is reachable only through a trusted reverse proxy that overwrites `X-Forwarded-For` and related geo headers.

## Custom Public Pages

The compose file mounts `SURLS_CUSTOM_PAGES_PATH` into the app container read-only. Choose the host path you want, set it in `deploy/1panel/.env`, and create it before starting the compose project:

```bash
mkdir -p /opt/surls/custom-pages/assets
```

Put these optional files in that host directory:

- `index.html` replaces the public home page.
- `404.html` replaces the app not-found page.
- `login.html` wraps the app-owned admin login and 2FA forms. It must include exactly one `{{LOGIN_FORM}}` placeholder.
- `assets/...` is served at `/assets/...` for CSS, images, fonts, JSON, and text assets.

The bind mount uses `create_host_path: false`, so Docker fails fast if the configured directory does not exist instead of auto-creating `/opt/surls/www` or another unintended path.

Filesystem pages take priority over uploaded custom pages in `Admin -> Settings`; uploaded pages remain as fallbacks. Custom pages suppress the built-in cookie banner so the replacement page controls its own public-facing chrome. Public custom pages are isolated in a sandboxed frame; inline scripts can run there for page-local interactions such as hash navigation, but they do not run in the main Surls app context. File contents are read at request time, so normal HTML changes do not require a container rebuild.

When a custom public `index.html` or `404.html` is active, the built-in `/privacy` and `/cookies` pages return 404 so the default public notices do not appear alongside a custom site. Other root HTML files in the custom-pages directory, such as `test.html`, are ignored and are not served at `https://your-domain/test.html`; put supporting CSS, images, fonts, JSON, or text files under `assets/` and reference them as `/assets/...`.

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
