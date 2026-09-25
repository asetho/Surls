# Surls Share for macOS

The **Share with Surls** extension uploads one shared file to a selected Surls site and copies its short URL to the clipboard. It can generate a random short keyword or check a custom keyword before uploading. The companion **Surls Share** app stores multiple sites, the default-site choice, and each site's API token.

> [!WARNING]
> **Unsigned development builds:** CI builds are unsigned, and there is currently no published Developer ID signed, notarized installer. macOS may block an unsigned copy or refuse to load its share extension. Build locally with your own Apple Development signing and provisioning profiles for development use. A locally development-signed app is not a notarized public distribution; do not assume the release workflow below means a signed download is available.

## Requirements

- macOS 14 or later and Xcode with the macOS SDK to build the app.
- An Apple development team and provisioning profiles supporting the matching App Group and Keychain Sharing capabilities for **both** targets.
- A reachable Surls HTTPS site and an API token that permits link/upload creation.

## Build and install locally

1. Open `SurlsShare.xcodeproj` in Xcode.
2. Select your development team for both targets. If you change the bundle IDs, update the App Group and Keychain Sharing capabilities on both targets so they continue to match.
3. Build the `SurlsShare` scheme for **My Mac** with development signing. Locate **Surls Share.app** in the build products and copy it to `/Applications`, keeping the embedded **Share with Surls.appex** intact. A public Developer ID export requires the separate release credentials described below.
4. Open Surls Share and add each site's HTTPS base URL and a newly generated token from **Tools → Tokens** in Surls. Copy the token when it is first shown; Surls cannot show it again later.
5. Select a default site.
6. Enable **Share with Surls** in System Settings → General → Login Items & Extensions → Sharing if macOS does not enable it automatically.

Finder and other apps can then use **Share → Share with Surls**. The extension lets you select a configured site, optionally enter a custom short keyword, and places the returned short URL on the clipboard.

The checked-in Xcode project is generated from `project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen).

Local development provisioning profiles expire. If the app or extension stops launching after an update or profile expiry, refresh signing for both targets in Xcode, rebuild, and replace the installed copy. Do not disable Gatekeeper system-wide to make a development build work.

## Usage and troubleshooting

The extension shares one file or image at a time. The server enforces file-size and storage limits: the request ceiling is 25 MiB, and the site or user can have a smaller allowance. Uploads are available through their short links.

If a request is unauthorized, check that the token is still active and has creation scopes. After rolling a token in Surls, replace it in the companion app. If the extension cannot see configured sites, confirm both targets use the same App Group and shared Keychain access group. Keep tokens out of screenshots, logs, and bug reports.

## CI and releases

The Mac app lives in the main Surls repository but has its own `MARKETING_VERSION` and build number in `project.yml`, independent of the server's `package.json` version. Its application source and Xcode project remain isolated under `Share-App/`.

`.github/workflows/surls-share.yml` independently builds the Mac app whenever its source, workflow, or upload API contract changes. CI runs unsigned Debug and Release builds; those builds validate the project but are not public distributions.

The app depends on the Surls upload API in `src/app/api/uploads/route.ts` and `src/lib/upload-and-shorten.ts`. Changes to that contract should be reviewed and released with the corresponding app changes.

The workflow supports a future signed public release **only when the required Developer ID and notarization credentials are configured**. It is started manually with the **Surls Share** workflow's `workflow_dispatch` trigger on `main`. The workflow derives a tag in the form `surls-share-vX.Y.Z` from `CFBundleShortVersionString`, signs with Developer ID, packages a DMG, submits it with `notarytool`, staples and verifies it, and then attaches it to a dedicated GitHub release. An ordinary server release does not publish a Mac installer.

After each successful publication, the workflow retains DMG and checksum assets for the newest three Surls Share versions. Older release records and tags remain available without their installer assets.

Before dispatching the workflow, update `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `project.yml`, run `xcodegen generate --spec Share-App/project.yml` from the repository root, and merge that version change to `main`. Dispatch the workflow from `main`; it rejects attempts to reuse an existing version tag that points to a different commit.

The release job requires the following repository configuration:

- Variable: `SURLS_SHARE_APPLE_TEAM_ID`
- Secrets: `SURLS_SHARE_DEVELOPER_ID_P12_BASE64`, `SURLS_SHARE_DEVELOPER_ID_P12_PASSWORD`, and `SURLS_SHARE_KEYCHAIN_PASSWORD`
- Secrets: `SURLS_SHARE_APP_PROVISIONING_PROFILE_BASE64` and `SURLS_SHARE_EXTENSION_PROVISIONING_PROFILE_BASE64`
- Secrets: `SURLS_SHARE_NOTARY_KEY_BASE64`, `SURLS_SHARE_NOTARY_KEY_ID`, and `SURLS_SHARE_NOTARY_ISSUER_ID`

The certificate must be a Developer ID Application certificate. Both provisioning profiles must match their respective bundle IDs and the shared App Group/Keychain capabilities. The notary secrets are an App Store Connect API private key, key ID, and issuer ID.
