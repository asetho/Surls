# Surls Share for macOS

The **Share with Surls** extension uploads one file from a macOS Share menu to a selected Surls site, then copies the short URL. The companion app stores multiple sites, a default-site choice, and each site's API token. The extension can generate a random short keyword or check a custom one.

!!! warning "Development builds"
    CI builds are unsigned. There is currently no published Developer ID signed, notarized installer. A local development-signed build is not a public notarized distribution, and macOS may block an unsigned copy or its extension.

To build locally, use macOS 14+ and Xcode with an Apple development team and matching App Group and Keychain Sharing capabilities for both targets:

1. Open `Share-App/SurlsShare.xcodeproj` from the [Surls repository](https://github.com/asetho/Surls/tree/main/Share-App).
2. Select the development team for both targets. Build the `SurlsShare` scheme for **My Mac** with development signing.
3. Copy the built **Surls Share.app** to `/Applications`, keeping its embedded extension intact.
4. Add your Surls HTTPS origin and a newly generated creation-scoped token from **Tools → Tokens**. Select a default site.
5. If needed, enable **Share with Surls** in System Settings → General → Login Items & Extensions → Sharing.

The server's file-size and storage limits still apply. For signing details, troubleshooting, and the separate release workflow, read the [Surls Share README](https://github.com/asetho/Surls/blob/main/Share-App/README.md).
