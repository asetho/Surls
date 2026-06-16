# Changelog

## 1.9.0 - 2026-06-15

### Added

* Added a live Theme Editor drawer that can stay open while browsing admin pages.
* Added admin toast notifications with editable success and error colors plus live test buttons.
* Added theme controls for links, pills, status badges, graph colors, map colors, and danger actions.
* Added AddToAny universal share menus with prioritized services for share actions.
* Added an admin dashboard-theme API endpoint for saving and resetting theme changes without leaving the current page.

### Changed

* Theme editing is grouped into light and dark mode tabs with collapsed color sections.
* Theme saves now use in-page toasts and keep the user on the current admin view.
* Admin pages, bookmarklet pages, buttons, badges, links, and charts now use the expanded dashboard theme tokens.
* Link creation now uses clearer button text and returns to the created link detail page.
* Backup-code and 2FA login screens have clearer layout and action styling.

### Fixed

* Improved chart hover alignment and date label positioning.
* Fixed bookmarklet handling so the bookmark can run without React blocking the `javascript:` URL.
* Removed extra historical chart helper text and tightened chart spacing.
* Cleaned up duplicate link color styling across admin pages.

### Security

* Kept destructive link deletion restricted to admins while retaining archive actions for normal users.

### Upgrade Notes

No manual upgrade steps required.

## 1.8.0 - 2026-06-13

### Added

* Added dedicated Theme Editor and Favicon Editor pages from Settings.

### Changed

* Settings now links to separate editors and shows compact editor summary cards.
* Favicon uploads now return to the Favicon Editor and keep save/reset actions together.
* Bookmarklet creation now follows the active dashboard theme and hosted favicon branding.
* Dashboard theme color fields now show an inline reset control after edits.

### Fixed

* Favicon status cards keep status badges anchored at the bottom-right with previews visible.

### Security

* No security changes.

### Upgrade Notes

No manual upgrade steps required.

## 1.7.0 - 2026-06-13

### Added

* Added dashboard theme customization with separate light and dark palettes.
* Added web app name controls and mobile-style previews for generated manifests.
* Added backup-code copy, download, saved-confirmation, and admin-only delete controls.

### Changed

* Favicons can now be added or replaced one file at a time without re-uploading the full package.
* Favicon status cards now show previews, cleaner status labels, and collapsible custom-page snippets.
* The admin sidebar now uses the hosted favicon when available and shows the current Surls version.
* The bookmarklet now uses a stable `ShortenURL` drag title and clearer helper text.
* The passkey setup field now uses muted password-manager examples instead of a prefilled name.

### Fixed

* Backup-code generation now uses first-time wording when no unused codes exist.
* Custom login placeholder text is styled as muted guidance across themes.

### Security

* Added a dedicated audit action for admin backup-code deletion.
* Refreshed dependency lockfile entries and confirmed `npm audit` reports no vulnerabilities.

### Upgrade Notes

Database migrations run automatically in Docker deployments.

## 1.6.0 - 2026-06-13

### Added

* Added admin-managed favicon uploads for modern browser icons and app manifests.
* Added hosted favicon URLs and a copyable snippet for custom public pages.

### Changed

* Settings now summarizes active custom pages instead of showing the old public webroot upload controls.

### Fixed

* Removed the cookie consent popup from the app shell.

### Upgrade Notes

No manual upgrade steps required.

## 1.5.2 - 2026-06-12

### Fixed

* Added mobile browser theme metadata so Safari and other mobile browser chrome can better match Surls pages.

### Upgrade Notes

No manual upgrade steps required.

## 1.5.1 - 2026-06-12

### Changed

* Improved the 2FA login screen with six separate authenticator-code boxes that support typing, paste, and browser one-time-code autofill.

### Upgrade Notes

No manual upgrade steps required.

## 1.5.0 - 2026-06-12

### Added

* Added a project versioning policy for future release decisions.
* Added admin destination warnings for HTTP, IP-literal, punycode, and userinfo-style URLs.
* Added redirect privacy handling for `DNT: 1` and `Sec-GPC: 1` requests.
* Added redirect analytics burst protection for high-volume click traffic.

### Changed

* Redirect and unavailable responses now send no-store cache headers so edited, disabled, expired, and click-limited links are not cached incorrectly.
* Privacy opt-out requests skip detailed click rows while preserving aggregate click-limit behavior where needed.

### Fixed

* Prevented high-volume redirect traffic from writing unlimited detailed analytics rows for the same link and visitor source.
* Logout now returns users to the standalone admin login page.

### Security

* Reduced detailed analytics collection for privacy opt-out requests.
* Added lightweight admin warnings for destination URLs that are easier to misread or misuse.

### Upgrade Notes

No manual upgrade steps required.
