# Surls Link Creator

Create Surls short links from inside WordPress.

## Features

- Settings page under `Settings -> Surls` for the Surls base URL and API token.
- Quick link form for any destination URL.
- Editor meta box for public post types so editors can create a Surls link for the current WordPress permalink.
- Stores created post links in post meta and returns them through WordPress' shortlink filter.

## Install

1. Copy the `surls-link-creator` folder into `wp-content/plugins/`.
2. Activate `Surls Link Creator` in WordPress.
3. In Surls, create an API token from `Admin -> Tools`.
4. In WordPress, open `Settings -> Surls` and save your Surls base URL and API token.

The base URL should be the public Surls origin, for example `https://links.example.com`.

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
