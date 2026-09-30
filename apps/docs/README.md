# Surls documentation

MkDocs Material builds this source as static files in `apps/docs/site/`. Run `python -m pip install -r apps/docs/requirements.txt` and `mkdocs build --strict --clean -f apps/docs/mkdocs.yml` to verify locally. The docs workflow builds on relevant pull requests and deploys the static output from `main` to the `surls-docs` Cloudflare Pages project. It uses `CLOUDFLARE_PAGES_API_TOKEN` and `SURLS_CLOUDFLARE_ACCOUNT_ID` in GitHub Actions. Attach `docs.surls.dev` to that Pages project only after checking existing DNS and Pages bindings.
