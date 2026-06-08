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

The first app boot runs migrations, creates missing app settings, and creates the initial admin if no users exist.

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
