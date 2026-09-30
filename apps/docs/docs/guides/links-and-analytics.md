# Links and analytics

## Manage a link

Surls supports generated and custom aliases. Link settings include title, destination, tags, notes, expiration, maximum clicks, enabled state, and archive state. Surls validates destinations and shows warnings for questionable URLs. The Links page also provides QR codes and copy/share controls.

Public redirects work at `/:code` and `/s/:code`. App-owned paths such as `/admin`, `/api`, and `/health` remain reserved. Public files in the configured webroot take precedence over one-segment short codes; use `/s/:code` if a file path would collide.

## Review traffic

The dashboard shows totals, recent activity, and top links. Link statistics include referrer, browser/device, and location views; CSV statistics export is available. A fresh installation has an empty dashboard. Marketing screenshots use synthetic sample data.

Surls skips detailed click analytics for requests with `DNT: 1` or `Sec-GPC: 1`, and for high-volume bursts. Redirects still work. Authenticated admin clicks are excluded from statistics by default; **Settings → Track admin clicks** changes that behavior. Raw click IP retention is limited to 30 days, and click-event retention is configurable.

## Other link tools

The Tools page includes a bookmarklet, API tokens, CSV import preview/import, exports, an SSRF-aware link checker, and a UTM builder. File uploads from **Tools → Upload & Shorten** use opaque storage names and are available through their short links. The request ceiling is 25 MiB and can be lowered; per-user and site storage quotas also apply.
