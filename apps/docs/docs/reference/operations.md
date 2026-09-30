# Operations and backups

## Health

`/api/health/live` checks that the app responds. `/api/health/ready` checks PostgreSQL and the configured webroot and is used by Docker health checks. `/api/health` and `/health` are compatibility aliases for liveness and readiness.

## Update

Read the target release notes and back up the database, uploads, public webroot, and `.env` first. Pin `SURLS_IMAGE` to the desired release, then:

```bash
docker compose pull app
docker compose up -d --no-deps --no-build app
docker compose ps
docker compose logs --tail=100 app
```

For a source build, use `docker compose build app` in place of `pull app`. Startup runs migrations. An image rollback alone may not reverse schema changes; restore the matching database backup if a downgrade requires it. Do not use `docker compose down -v` for normal updates because it removes the database volume.

## Back up and restore

Store backups outside the webroot and uploads directory. A database-only dump omits uploaded bytes and filesystem public pages. A private PostgreSQL logical backup can be made with:

```bash
install -d -m 700 ../surls-backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ../surls-backups/surls.dump
```

Back up the directory named by `SURLS_UPLOADS_PATH`, the webroot, and `.env` including stable keys. Test a restoration into a separate empty database before relying on it. Verify sign-in, redirect, uploaded-file download, and custom-page rendering. See the [complete deployment guide](https://github.com/asetho/Surls/blob/main/docs/deployment.md#backups-and-restoration).
