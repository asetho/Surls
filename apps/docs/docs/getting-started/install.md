# Install with Docker Compose

The repository's root `docker-compose.yml` is the supported deployment path. It runs the app and PostgreSQL; your Surls short-link domain points to the app through your own HTTPS proxy.

## Prepare files and secrets

```bash
git clone https://github.com/asetho/Surls.git
cd Surls
cp .env.example .env
mkdir -p www uploads
openssl rand -hex 24    # paste into POSTGRES_PASSWORD
openssl rand -base64 32 # paste into AUTH_SECRET
openssl rand -base64 32 # paste into NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
```

Edit `.env` and replace the placeholders. Set `BASE_URL` to the exact public origin (for example `https://links.example.com`, without a trailing slash). Set `WEBAUTHN_RP_ID` to its hostname and `WEBAUTHN_ORIGIN` to the same HTTPS origin. Set `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, and a unique `INITIAL_ADMIN_PASSWORD` of at least 12 characters. Keep the database password and both application keys stable and backed up securely.

On a Linux Docker host, make the upload directory writable by the container user:

```bash
sudo chown 1000:1000 uploads
```

The webroot needs read and directory traverse permission. Keep private files outside it.

## Start Surls

For a published image, set `SURLS_IMAGE` in `.env` to a release tag, then run:

```bash
docker compose pull
docker compose up -d --no-build
docker compose ps
docker compose logs --tail=100 app
```

Alternatively, build the checked-out source with `docker compose build app`, followed by `docker compose up -d --no-build`. Startup applies database migrations and creates the initial admin if it does not exist.

Open `/admin` on your Surls origin. After the first successful sign-in, remove `INITIAL_ADMIN_PASSWORD` from `.env` and recreate the app:

```bash
docker compose up -d --no-deps --force-recreate app
```

## Put it behind HTTPS

Point your short-link domain at a reverse proxy that terminates TLS and forwards requests to the app on port 3000, preserving the public host and scheme. Restrict direct access to the app port. For a proxy on the same host, `SURLS_PORT=127.0.0.1:3000` limits the published port to loopback. Keep `TRUST_PROXY=false` unless you control the entire proxy boundary and overwrite incoming client-IP headers.

Check `/api/health/ready`, admin sign-in, a test redirect, and an uploaded-file link. The detailed [deployment guide in the repository](https://github.com/asetho/Surls/blob/main/docs/deployment.md) covers proxy trust, upgrades, backups, and troubleshooting.
