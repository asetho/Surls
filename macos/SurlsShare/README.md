# Surls Share for macOS

The **Share with Surls** extension uploads one shared file to a selected Surls site and copies its short URL to the clipboard. It can generate a random short keyword or check a custom keyword before uploading. The companion **Surls Share** app stores multiple sites, the default-site choice, and each site's API token.

## Build and install

1. Open `SurlsShare.xcodeproj` in Xcode.
2. Select your development team for both targets. If you change the bundle IDs, update the App Group and Keychain Sharing capabilities on both targets so they continue to match.
3. Build an Archive of the `SurlsShare` scheme, then copy the exported app to `/Applications`.
4. Open Surls Share and add each site's HTTPS base URL and a newly generated token from `Admin -> Tools`.
5. Select a default site.
6. Enable **Share with Surls** in System Settings → General → Login Items & Extensions → Sharing if macOS does not enable it automatically.

Finder and other apps can then use **Share → Share with Surls**. The extension lets you select a configured site, optionally enter a custom short keyword, and places the returned short URL on the clipboard.

The checked-in Xcode project is generated from `project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen).

## CI and releases

The Mac app is maintained on the long-lived `surls-share-app` branch and is not merged into `main`. App feature branches should target `surls-share-app` so its history and release process remain separate from the main Surls application.

`.github/workflows/surls-share.yml` independently builds the Mac app whenever its source, workflow, or upload API contract changes. CI runs unsigned Debug and Release builds; those builds validate the project but are not public distributions.

The app depends on the Surls upload API. If an app change also changes that server-side contract, publish the server portion through a separate change to `main`; code that exists only on `surls-share-app` is not part of the production Surls deployment.

Public releases use tags in the form `surls-share-v1.0.1`. The tag version must match `CFBundleShortVersionString`. A release build is signed with Developer ID, packaged as a DMG, submitted with `notarytool`, stapled, verified, and attached to a dedicated GitHub release.

Before tagging, update `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `project.yml`, run `xcodegen generate --spec macos/SurlsShare/project.yml` from the repository root, and commit and push that version change to `surls-share-app`. The release workflow rejects tags that are not contained in `surls-share-app` or do not match the project version.

The release job requires the following repository configuration:

- Variable: `SURLS_SHARE_APPLE_TEAM_ID`
- Secrets: `SURLS_SHARE_DEVELOPER_ID_P12_BASE64`, `SURLS_SHARE_DEVELOPER_ID_P12_PASSWORD`, and `SURLS_SHARE_KEYCHAIN_PASSWORD`
- Secrets: `SURLS_SHARE_APP_PROVISIONING_PROFILE_BASE64` and `SURLS_SHARE_EXTENSION_PROVISIONING_PROFILE_BASE64`
- Secrets: `SURLS_SHARE_NOTARY_KEY_BASE64`, `SURLS_SHARE_NOTARY_KEY_ID`, and `SURLS_SHARE_NOTARY_ISSUER_ID`

The certificate must be a Developer ID Application certificate. Both provisioning profiles must match their respective bundle IDs and the shared App Group/Keychain capabilities. The notary secrets are an App Store Connect API private key, key ID, and issuer ID.
