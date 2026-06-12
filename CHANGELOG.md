# Changelog

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
