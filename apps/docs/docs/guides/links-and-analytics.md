# Links and analytics

## Manage a link

New links without a custom alias get a five-character code chosen from uppercase letters, lowercase letters, and digits. Codes are case-sensitive: `/Ab3dE` and `/ab3de` are different links. Existing links keep their codes. Short codes are convenient to share, but they are not access control for a sensitive destination.

Link settings include title, destination, tags, notes, expiration, maximum clicks, enabled state, and archive state. Surls validates destinations and shows warnings for questionable URLs. The Links page also provides QR codes and copy/share controls.

Public redirects work at `/:code` and `/s/:code`. App-owned paths such as `/admin`, `/api`, and `/health` remain reserved. Public files in the configured webroot take precedence over one-segment short codes; use `/s/:code` if a file path would collide.

## Review traffic

The dashboard shows totals, recent activity, and top links. Link statistics include referrer, browser/device, and location views; CSV statistics export is available. A fresh installation has an empty dashboard. Marketing screenshots use synthetic sample data.

Surls skips detailed click analytics for requests with `DNT: 1` or `Sec-GPC: 1`, and for high-volume bursts. Redirects still work. Authenticated admin clicks are excluded from statistics by default; **Settings → Track admin clicks** changes that behavior. Raw click IP retention is limited to 30 days, and click-event retention is configurable.

## Other link tools

The Tools page includes a bookmarklet, API tokens, CSV import preview/import, exports, an SSRF-aware link checker, and a UTM builder. File uploads from **Tools → Upload & Shorten** use opaque storage names and are available through their short links. New automatic upload links use the same five-character code rule. The Links page marks uploaded files with a paperclip and an **Uploaded file** tooltip.

The default per-file upload limit is 25 MiB. A site admin can set a different site or user limit, or choose **No limit** for a user. Uploads stream to disk; per-user and site storage quotas still apply, and a reverse proxy or hosting provider can impose its own request limit. Permanently deleting the last link to an upload deletes the stored file. Archiving or disabling a link leaves the file in place.
