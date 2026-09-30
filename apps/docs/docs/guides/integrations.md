# Integrations

## API tokens

Create a token under **Tools → Tokens** with the scopes needed by each integration. Copy it when it is first displayed; Surls cannot show the token again. You can revoke or replace tokens from the same page. Keep each token out of logs and screenshots.

## WordPress link creator

The included [Surls Link Creator plugin](https://github.com/asetho/Surls/tree/main/wordpress/surls-link-creator) creates links from WordPress. It requires WordPress 6.0+, PHP 7.4+, a reachable Surls HTTPS origin, and a token allowed to create links.

1. Copy `wordpress/surls-link-creator` from the Surls repository into `wp-content/plugins/` and activate it.
2. Create a dedicated Surls token from **Tools → Tokens**.
3. In WordPress, open **Settings → Surls** and save the HTTPS Surls base URL and token.
4. Use **Test saved connection** to check reachability and permission without making a link. This test needs Surls 3.0.0 or later.

The plugin offers a quick-link form and a post editor meta box for public post types. It stores generated short links in post metadata. See the [plugin README](https://github.com/asetho/Surls/blob/main/wordpress/surls-link-creator/README.md) for the API contract and token notes.

## macOS sharing

The separate [Surls Share app](macos-share.md) can upload one shared file and copy its short link. Its current CI builds are unsigned; follow the local development-signing instructions before use.
