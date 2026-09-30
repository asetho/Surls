# Troubleshooting

| Symptom | First checks |
| --- | --- |
| Proxy returns 502 | Run `docker compose ps` and `docker compose logs --tail=100 app`; verify proxy target and port binding. |
| App is unhealthy | Check `/api/health/ready`, database migrations, and webroot permissions. |
| Files cannot be uploaded | Verify `SURLS_UPLOADS_PATH` exists and UID/GID `1000:1000` can write to it; check quota and size limits. |
| Passkey sign-in fails | Confirm HTTPS, `BASE_URL`, `WEBAUTHN_RP_ID`, and `WEBAUTHN_ORIGIN` match the public site. |
| External provider callback fails | Copy the exact callback from Surls Settings and check the registered URI, issuer, client credentials, and container connectivity. |
| Public page is missing | Confirm its file exists beneath the mounted webroot and can be read by the container user. |

The readiness endpoint does not check every custom asset or `login.html`. Test the homepage, login, representative links, and uploaded files after changing public content. A Prisma `P3015` error indicates a missing migration SQL file; deploy a complete image or source checkout rather than deleting migration history.

For more detail, consult the [deployment guide](https://github.com/asetho/Surls/blob/main/docs/deployment.md#health-and-troubleshooting) or [open an issue](https://github.com/asetho/Surls/issues).
