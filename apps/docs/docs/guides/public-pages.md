# Public pages and appearance

Surls includes a default informational homepage. The `SURLS_PUBLIC_WEBROOT_PATH` directory lets an owner provide `index.html`, `404.html`, and additional public files without rebuilding the app. In Compose it defaults to `./www` on the host and mounts read-only at `/app/www`. Create the directory before starting Docker; if it is empty, Surls uses the included homepage.

Public files such as `/assets/site.css` are served directly. An exact public file wins over a one-segment short code, while app-owned paths remain reserved. `login.html` is reserved as an admin login template and is not public. It must contain exactly one `{{LOGIN_FORM}}` placeholder; optional `{{LOGIN_TITLE}}` and `{{LOGIN_TAGLINE}}` placeholders can be included.

Public HTML runs on the same origin as your short-link application. Allow only trusted admins to write this directory. Keep backups, keys, and private files elsewhere because readable files beneath the webroot may be served by URL. See the [repository's public webroot guide](https://github.com/asetho/Surls#public-webroot) for file precedence and login styling hooks.

The admin interface has Light, Dark, and Auto modes. Admins can use **Settings → Dashboard theme → Open Theme Editor** to edit palettes, preview or export a theme, or restore the included default. The app also supports managed favicons and public pages from Settings.
