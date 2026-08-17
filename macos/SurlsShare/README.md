# Surls Share for macOS

The **Share with Surls** extension uploads one shared file to the configured default Surls site and copies its short URL to the clipboard. The companion **Surls Share** app stores multiple sites, the default-site choice, and each site's API token.

## Build and install

1. Open `SurlsShare.xcodeproj` in Xcode.
2. Select your development team for both targets. If you change the bundle IDs, update the App Group and Keychain Sharing capabilities on both targets so they continue to match.
3. Build an Archive of the `SurlsShare` scheme, then copy the exported app to `/Applications`.
4. Open Surls Share and add each site's HTTPS base URL and a newly generated token from `Admin -> Tools`.
5. Select a default site.
6. Enable **Share with Surls** in System Settings → General → Login Items & Extensions → Sharing if macOS does not enable it automatically.

Finder and other apps can then use **Share → Share with Surls**. The extension uploads to the default site and places the returned short URL on the clipboard.

The checked-in Xcode project is generated from `project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen).
