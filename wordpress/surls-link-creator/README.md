# Surls Link Creator

Create Surls short links from inside WordPress.

Requires WordPress 6.0 or later, PHP 7.4 or later, and a reachable Surls site. The plugin uses the authenticated link-creation API; it does not replace Surls' redirect service.

## Features

- Settings page under `Settings -> Surls` for the Surls base URL and API token.
- Quick link form for any destination URL.
- Editor meta box for public post types so editors can create a Surls link for the current WordPress permalink.
- Stores created post links in post meta and returns them through WordPress' shortlink filter.

## Install

1. Copy the `surls-link-creator` folder into `wp-content/plugins/`.
2. Activate `Surls Link Creator` in WordPress.
3. In Surls, create a dedicated API token from **Tools → Tokens** and copy it when first shown.
4. In WordPress, open `Settings -> Surls` and save your Surls base URL and API token.

The base URL should be the public Surls origin, for example `https://links.example.com`.

The token must permit link creation. If it expires, is revoked, or is rolled in Surls, save a replacement in WordPress. Use HTTPS and restrict access to the plugin's settings and WordPress database backups, which contain its configured token.

## API Contract

The plugin calls:

```bash
POST /api/links
Authorization: Bearer surls_...
Content-Type: application/json
```

With payload fields supported by Surls:

```json
{
  "destinationUrl": "https://example.com/post",
  "code": "optional-code",
  "title": "Optional title",
  "tags": ["wordpress", "post"]
}
```

Surls returns the created `shortUrl`, which WordPress stores on the post when links are created from the editor.
