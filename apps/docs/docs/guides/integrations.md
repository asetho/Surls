# Integrations

## API tokens

Create a token under **Tools → Tokens** with the permissions needed by each integration. **Create short links** grants `links:create`; **Upload files and create their short links** grants `uploads:create`. Both are selected initially, and you can choose either one alone. Copy the token when it is first displayed; Surls cannot show it again. To change permissions on an existing token, create a replacement and revoke the old token. You can also roll a token to replace its secret while keeping its permissions. Keep tokens out of logs and screenshots.

## WordPress link creator

The included [Surls Link Creator plugin](https://github.com/asetho/Surls/tree/main/wordpress/surls-link-creator) creates links from WordPress. It requires WordPress 6.0+, PHP 7.4+, a reachable Surls HTTPS origin, and a token allowed to create links.

1. Copy `wordpress/surls-link-creator` from the Surls repository into `wp-content/plugins/` and activate it.
2. Create a dedicated Surls token with **Create short links** permission from **Tools → Tokens**.
3. In WordPress, open **Settings → Surls** and save the HTTPS Surls base URL and token.
4. Use **Test saved connection** to check reachability and permission without making a link. This test needs Surls 3.0.0 or later.

The plugin offers a quick-link form and a post editor meta box for public post types. It stores generated short links in post metadata. See the [plugin README](https://github.com/asetho/Surls/blob/main/wordpress/surls-link-creator/README.md) for the API contract and token notes.

## macOS sharing

The separate [Surls Share app](macos-share.md) can upload one shared file and copy its short link. Give it a token with **Upload files and create their short links** permission. A [signed and notarized installer](https://github.com/asetho/Surls/releases/tag/surls-share-v1.0.5) is available for general distribution; CI development builds remain unsigned.
