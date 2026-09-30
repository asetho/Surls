# Requirements

For the supported installation path you need:

- A host with Docker and Docker Compose v2.
- A domain and an HTTPS reverse proxy for a public deployment. Localhost testing can run without the proxy.
- Persistent storage for PostgreSQL, uploaded files, and optional public pages.
- A secure place to keep the `.env` file and backups.

The repository's Compose stack runs Surls and PostgreSQL 18. It mounts `./uploads` as writable storage and `./www` as a read-only public webroot. Create both directories before starting; missing paths fail rather than being silently created. On Linux, the app runs as UID/GID `1000:1000`, which must be able to write uploads and read the webroot.

For source development outside Docker, Surls requires Node.js 26+, npm, and PostgreSQL. See [local development in the repository README](https://github.com/asetho/Surls#local-development).

[Install with Docker Compose](install.md){ .md-button .md-button--primary }
