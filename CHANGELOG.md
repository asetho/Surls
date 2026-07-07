# Changelog

## 1.14.4 - 2026-07-06

### Fixed

* Kept admin link form labels left-aligned in modal layouts.
* Made recent-click IP addresses quiet links to IP lookup details.
* Left-aligned click counts in the admin links table.
* Restored QR help icon contrast in light-mode modals.

### Upgrade Notes

No manual upgrade steps required.

## 1.14.3 - 2026-07-01

### Fixed

* Cleaned up admin links table sort headers so inactive sort controls no longer crowd adjacent column labels.
* Widened the admin links Short URL column so keyword-style aliases remain readable alongside QR actions.

### Upgrade Notes

No manual upgrade steps required.

## 1.14.2 - 2026-07-01

### Changed

* Moved Style Reference theme and structural token panels below the component examples and collapsed them by default.
* Tightened the admin links table so destination text truncates before fixed metadata and action columns drift out of alignment.

### Upgrade Notes

No manual upgrade steps required.

## 1.14.1 - 2026-07-01

### Fixed

* Restored normal Copy and Share button icon/text layout in dense admin table action cells.
* Removed deprecated compatibility-token cards from the Theme Editor drawer.
* Removed Theme Editor reset-to-built-in-default controls, keeping only reset controls for unsaved field changes.

### Upgrade Notes

No manual upgrade steps required.

## 1.14.0 - 2026-07-01

### Added

* Added a canonical CSS and visual-style audit with a local preview artifact.
* Added read-only structural visual-token documentation for typography, spacing, radius, controls, tables, shadows, motion, layers, and breakpoints.
* Added Theme Editor search, group filtering, and saved-change indicators.
* Added shared dense table variants for admin links, users, API tokens, dashboard tables, recent clicks, and style reference samples.

### Changed

* Grouped admin Tools into tabs for creation, tokens, import/export, utilities, and system information.
* Split new admin table and Theme Editor styling into focused CSS layers outside the legacy global stylesheet.

### Fixed

* Kept link-list timestamps, numeric cells, and row actions aligned while giving destinations more space at normal zoom.
* Derived the standalone redirect fallback palette from dashboard theme defaults.
* Added reduced-motion and forced-colors coverage for core admin UI primitives.

### Upgrade Notes

No manual upgrade steps required.

## 1.13.9 - 2026-06-30

### Fixed

* Added upload storage settings and volume wiring to the root Docker Compose deployment.

## 1.13.8 - 2026-06-30

### Added

* Added Tools upload-and-shorten support for storing admin uploads and creating short links to `/uploads` files.

### Fixed

* Kept admin link-list action controls on one line at normal desktop zoom.

## 1.13.7 - 2026-06-30

### Fixed

* Fixed admin link-list column sizing so Created timestamps, status, clicks, and action controls line up while long destinations truncate.

## 1.13.6 - 2026-06-30

### Added

* Added per-user display timezone preferences with the app-wide timezone retained as the default.
* Added admin controls for editing user timezone preferences and profile controls for choosing a personal timezone.
* Added API token source snapshots on links created through the API.
* Added a WordPress link creator helper plugin for creating Surls links from WordPress.

### Changed

* Used the resolved viewer timezone for admin timestamps, link history, recent clicks, profile passkeys, link lists, and user dates.
* Added created-date display and created-date sorting on the admin link list.
* Clarified the Settings timezone field as the app-wide default timezone.

### Upgrade Notes

Run database migrations before starting the new version so user timezone preferences and API token source snapshots are added.

## 1.13.5 - 2026-06-29

### Added

* Saved each user's link-list and recent-click row counts so the chosen rows per page persist across sessions.

### Changed

* Removed the git hash from the admin sidebar version label.

### Upgrade Notes

Run database migrations before starting the new version so user row-count preferences are added.

## 1.13.4 - 2026-06-28

### Added

* Added directive-specific CSP extra-source environment variables for multi-server installs.

### Changed

* Truncated long destination titles and URLs in admin link tables with full text available on hover.
* Kept graph tab styling aligned with the shared segmented-control theme controls.

### Fixed

* Removed the extra location-chart helper line.
* Treated imported `direct` referrer labels as Direct traffic instead of listing them as top referrers.

### Upgrade Notes

No manual upgrade steps required.

## 1.13.2 - 2026-06-22

### Fixed

* Removed the Turnstile challenge widget after successful verification so only the sign-in form remains visible.
* Added a CSS guard so component display rules cannot keep a verified Turnstile gate visible.

### Upgrade Notes

No manual upgrade steps required.

## 1.13.1 - 2026-06-22

### Fixed

* Hid password login fields until the Turnstile security check succeeds.
* Centered the Turnstile challenge box and removed the extra completed-check message after verification.

### Upgrade Notes

No manual upgrade steps required.

## 1.13.0 - 2026-06-22

### Added

* Added optional Cloudflare Turnstile protection before password login forms load.
* Added server-side Turnstile verification for password login attempts when Turnstile keys are configured.

### Changed

* Documented Turnstile configuration for local, Docker Compose, and 1Panel installs.
* Updated the app content security policy to allow the Cloudflare Turnstile challenge script, frame, and verification traffic.

### Upgrade Notes

Set both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to enable Turnstile. Leave both empty to keep the existing login flow.

## 1.12.6 - 2026-06-20

### Fixed

* Kept the admin sidebar stationary while the Theme Editor drawer is open by only tightening the main content column.

### Upgrade Notes

No manual upgrade steps required.

## 1.12.3 - 2026-06-19

### Fixed

* Made Theme Editor hiding slide the drawer to the right while keeping a compact restore handle available.
* Added collapsible admin navigation in mobile and Theme Editor preview layouts.
* Derived keyboard focus rings automatically from the active theme instead of exposing them as editable colors.
* Normalized form control heights and style-reference pill samples across narrow views.
* Matched historical range controls to the statistics tab styling.
* Moved the short URL external-open icon to the left of the shortcode.

### Upgrade Notes

No manual upgrade steps required.

## 1.12.2 - 2026-06-18

### Fixed

* Restored link statistics controls to a tab-strip layout while keeping their colors editable from the theme editor.
* Made the Theme Editor drawer condense the live admin page into a mobile-style preview while it is open.
* Matched toast notification close icons to the toast text color.

### Upgrade Notes

No manual upgrade steps required.

## 1.12.1 - 2026-06-18

### Fixed

* Made empty countries more visible on traffic maps while still using the editable map palette.
* Increased pie-chart slice contrast for clearer chart previews and analytics charts.
* Normalized sample pill and action-button height/radius on the style reference page.

### Upgrade Notes

No manual upgrade steps required.

## 1.12.0 - 2026-06-17

### Added

* Added dashboard theme export and import controls.
* Added a style reference page with live theme coverage examples and Theme Editor drawer support.
* Added editable notice-toast colors alongside success and error toast colors.
* Added a permanent API token expiration option plus admin token deletion.

### Changed

* Bookmarklet popups now use a smaller window and show created links with a cleaner ShortURL-created summary.
* Theme graph previews now derive pie slices from the main graph color.
* 2FA setup now has a cancel path, tighter code entry layout, and QR-only framing.
* Backup-code results close after saved confirmation or deletion.

### Fixed

* Link checker results now use shared toast notifications.
* Historical tab inactive labels and map intensity colors are clearer across themes.
* Admin pills, settings status pills, action controls, placeholders, and form controls are more consistently themed.

### Upgrade Notes

No manual upgrade steps required.

## 1.11.0 - 2026-06-17

### Added

* Added support for a custom `unavailable.html` public page for archived, disabled, expired, and click-limited short URLs.

### Changed

* Admin tables now adapt into labeled cards on mobile so links, users, API tokens, recent clicks, and dashboard tables fit small screens.
* The Theme Editor now opens cleanly from `?themeEditor=open` without starting minimized from saved browser state.

### Fixed

* Allowed AddToAny stats requests through the app content security policy.
* Tightened mobile modal sizing and close-button layout.

### Upgrade Notes

No manual upgrade steps required.

## 1.10.1 - 2026-06-17

### Fixed

* Updated the production dependency lockfile so Hono resolves to the patched `4.12.25` release.

### Security

* Cleared the npm audit finding for Hono advisories affecting CORS middleware and selected adapter/static-serving paths.

### Upgrade Notes

No manual upgrade steps required.

## 1.10.0 - 2026-06-16

### Added

* Added scoped API tokens with configurable expiration.
* Added configurable click-event and audit-log retention settings.
* Added startup cleanup for stale raw IP addresses, click events, and audit logs.
* Added hardening tests for token scope, retention cleanup, API imports, stats exports, and raw IP visibility.

### Changed

* API token creation now offers supported expiration choices and stores token scopes.
* Click stats exports and link detail pages only expose raw IP addresses to admins.
* Bulk imports now validate destination URLs with the same safety checks used by link creation.
* Typechecking now removes generated Next type conflict files before running.

### Fixed

* Tightened trusted-proxy parsing so forwarded IP headers are only honored from configured trusted proxy addresses.
* Hardened destination validation against private/internal IP destinations and DNS results.
* Blocked unsafe destination URLs during link edits and API-created links.

### Security

* Existing API tokens are migrated to the `links:create` scope.
* Raw IP addresses are purged after 30 days while longer click-event and audit-log retention remain configurable.
* Non-admin users no longer receive raw IP addresses in link detail views or stats CSV exports.

### Upgrade Notes

Run database migrations before starting the new version so API token scope and expiration columns are added. Review `API_TOKEN_DAYS`, `CLICK_EVENT_RETENTION_DAYS`, and `AUDIT_LOG_RETENTION_DAYS` for your retention policy.

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
