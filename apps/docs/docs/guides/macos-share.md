# Surls Share for macOS

The **Share with Surls** extension uploads one file from a macOS Share menu to a selected Surls site, then copies its short URL. The companion app stores multiple sites, a default-site choice, and each site's API token. Leave the keyword blank for a server-generated code, or check a custom one before uploading.

## Install the signed app

Download the signed, notarized DMG and checksum from the [Surls Share v1.0.5 release](https://github.com/asetho/Surls/releases/tag/surls-share-v1.0.5). Open the DMG and copy **Surls Share.app** to `/Applications`, keeping its embedded extension intact. This public installer is separate from Surls server releases.

1. In your Surls site, open **Tools → Tokens** and create a token with **Upload files and create their short links** permission (`uploads:create`). Copy it when shown; Surls cannot show it again.
2. Open Surls Share, add your site's HTTPS origin and token, and choose a default site.
3. If needed, enable **Share with Surls** in System Settings → General → Login Items & Extensions → Sharing.
4. In Finder or another app, select a file and choose **Share → Share with Surls**.

The extension reads the token owner's upload policy. The default per-file limit is 25 MiB, but an administrator can set a larger or unlimited per-file policy. Per-user and site storage quotas, plus any proxy upload limit, still apply. With Surls 3.6.0, new automatic upload links have five-character, case-sensitive codes.

If macOS repeatedly asks whether the extension may read its saved site profiles from Keychain, verify that the prompt names your installed Surls Share extension, then choose **Always Allow** with your Mac login password.

## Build locally

CI development builds are unsigned and are not public installers. For a local development build, use macOS 14+ and Xcode with an Apple development team and matching App Group and Keychain Sharing capabilities for both targets:

1. Open `Share-App/SurlsShare.xcodeproj` from the [Surls repository](https://github.com/asetho/Surls/tree/main/Share-App).
2. Select the development team for both targets. Build the `SurlsShare` scheme for **My Mac** with development signing.
3. Copy the built **Surls Share.app** to `/Applications`, keeping its embedded extension intact.

Development provisioning profiles expire. The signed public DMG is the general-distribution option. For signing details and troubleshooting, read the [Surls Share README](https://github.com/asetho/Surls/blob/main/Share-App/README.md).
