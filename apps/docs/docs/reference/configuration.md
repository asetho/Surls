# Configuration reference

Set values in the repository's `.env` before starting Compose. This is a focused overview; the [environment template](https://github.com/asetho/Surls/blob/main/.env.example) contains the complete set.

| Setting | Purpose |
| --- | --- |
| `SURLS_IMAGE` | Pin a published Surls release image for predictable updates. |
| `POSTGRES_PASSWORD` | Database password used by the Compose PostgreSQL service. Generate a hex value. |
| `AUTH_SECRET` | Authentication and encrypted-credential key. Keep stable and back it up. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Stable key shared by build and runtime for Server Actions. |
| `BASE_URL` | Exact public Surls application origin, without trailing slash. |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | Passkey hostname and matching origin. |
| `SURLS_PORT` | Published app port; use `127.0.0.1:3000` for a local reverse proxy. |
| `SURLS_PUBLIC_WEBROOT_PATH` | Existing read-only public-page directory, default `./www`. |
| `SURLS_UPLOADS_PATH` | Existing writable upload directory, default `./uploads`. |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD` | First admin; remove the password after first login. |
| `TRUST_PROXY` | Leave `false` unless you control and sanitize every proxy hop. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional pair; set both or neither. |
| `UPLOAD_MAX_BYTES` | Lower the 25 MiB request ceiling. |
| `UPLOAD_USER_STORAGE_QUOTA_BYTES`, `UPLOAD_SITE_STORAGE_QUOTA_BYTES` | Upload quota controls. |
| `CLICK_EVENT_RETENTION_DAYS`, `AUDIT_LOG_RETENTION_DAYS` | Retention windows, 365 days by default. |

`DATABASE_URL` in `.env` is for host-run development. Compose builds the app's container connection URL from `POSTGRES_*` values and the internal database hostname. Optional SMTP and external-provider settings are listed in the [deployment](https://github.com/asetho/Surls/blob/main/docs/deployment.md) and [external sign-in](https://github.com/asetho/Surls/blob/main/docs/external-sign-in.md) guides.
