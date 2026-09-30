# Surls marketing site

`npm run build` copies the dependency-free source and public assets to `static-dist/` for Cloudflare Pages. No Surls server code runs on Pages. The site uses the default Surls app icon, palette, buttons, and typography from the application; the preview screenshot is marked as synthetic sample data.

The `site.yml` workflow builds on relevant pull requests and deploys on `main` to the `surls-site` Pages project. Set the `CLOUDFLARE_PAGES_API_TOKEN` secret and `SURLS_CLOUDFLARE_ACCOUNT_ID` repository variable before production deployment. Attach `surls.dev` to that project in Cloudflare only after checking existing DNS and Pages bindings.
