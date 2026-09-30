# Theme coverage matrix

Captured on 2026-09-29 in the local Chromium preview. “Checked” means the page was rendered and captured at both 390×844 and 1440×900. A custom draft was previewed without saving. The built-in homepage and admin use different stored preferences, as documented in `README.md`.

| Surface | Light | Dark | System/Auto | Custom draft | Notes |
| --- | --- | --- | --- | --- | --- |
| Homepage `/` | Checked | Checked | Cycling control checked after the audit baseline | Outside admin editor | [New light control](screenshots/home__1440x900__light__cycle-switcher.jpg), [new dark mobile control](screenshots/home__390x844__dark__cycle-switcher.jpg). |
| Bookmarklet `/bookmarklet` | Checked | Checked | No separate system screenshot | Outside admin editor | Uses admin visual system. |
| Dashboard `/admin` | Checked | Checked | Source path inspected | Draft not captured here | See [desktop light](screenshots/dashboard__1440x900__light__default.jpg) and [dark](screenshots/dashboard__1440x900__dark__default.jpg). |
| Links list `/admin/links` | Checked | Checked | Source path inspected | Draft not captured here | Includes [dark QR dialog](screenshots/links__390x844__dark__qr-dialog.jpg). |
| Link detail `/admin/links/[id]` | Checked | Checked | Source path inspected | Draft not captured here | React key warning in both modes. |
| Tools `/admin/tools` | Checked | Checked | Source path inspected | Draft not captured here | No unexpected asset failure. |
| Users `/admin/users` | Checked | Checked | Source path inspected | Draft not captured here | Read-only walkthrough. |
| Settings `/admin/settings` | Checked | Checked | Source path inspected | Editor open, no save | [Light drawer](screenshots/settings-theme__1440x900__light__drawer-open.jpg). |
| Email settings `/admin/settings/email` | Checked | Checked | Source path inspected | Draft not captured here | No SMTP form submitted. |
| Favicon editor `/admin/settings/favicons/editor` | Checked | Checked | Source path inspected | Draft not captured here | No asset saved. |
| Style reference `/admin/style-reference` | Checked | Checked | Source path inspected | Checked for one pill token | [Draft preview](screenshots/style-reference__1440x900__custom-preview__short-url-pill.jpg). |
| Profile `/admin/profile` | Checked | Checked | Source path inspected | Draft not captured here | No account setting submitted. |
| Disabled/expired public links | Fixed dark | Fixed dark | Not theme responsive | N/A | [Disabled example](screenshots/unavailable-disabled__390x844__fixed-dark__default.jpg). |
| 404 page | Checked light | Not captured | Not captured | N/A | [404 example](screenshots/not-found__390x844__light__default.jpg). |

## What the editor visibly controls

The drawer exposes separate light and dark groups for sidebar, panels and text, actions and pills, graphs and maps, and toast notifications. Changing the light Short URL pill HEX field from `#e6f2f8` to `#ffcc00` changed the computed `--short-url-pill-background` and the live style-reference pill background; the original value was restored in the unsaved draft. This proves one live token preview, not save persistence or every field.

The style reference renders typography, actions, forms, pills and links, tables and stats, tabs and charts, maps, notices, toasts, empty states, the theme token registry, and structural token registry. It does not give a visual sample for the public homepage palette or every modal/drawer validation state. A full custom-theme route sweep was not performed.

## Token and CSS inspection

| Area | Observed state | Coverage / recommendation |
| --- | --- | --- |
| Admin palette | `src/lib/dashboard-theme.ts` maps editable theme fields to CSS custom properties; computed light/dark samples are in [computed-style-samples.json](computed-style-samples.json). | Keep preview behavior; test save/import/export separately with disposable settings. |
| Structural tokens | `src/lib/visual-tokens.ts` labels `--control-height` as `2.58rem`; `src/app/globals.css` defines `2.12rem`. | Reconcile source-of-truth values before relying on style-reference documentation. |
| Homepage palette | Inline tokens in `src/lib/default-homepage.ts`, independently controlled by `surls-home-theme`. | The admin editor has no homepage controls; document that boundary in the editor as well as README if intentional. |
| Public unavailable page | Fixed dark appearance under a light preference. | Decide whether this page should inherit the public theme. |
| Danger colors | Dark filled button white on `#e65057` is about 3.72:1; dark outline text `#e65057` on `#0c354b` is about 3.47:1. | Tune the dark danger text/background pair to at least 4.5:1 for normal-size labels. |
| Unused tokens | Not established by this visual pass. | Run static token-use analysis before deleting any token. |

## Limits

System color-scheme changes were not simulated; source inspection shows both public and admin follow system preferences. Dark and light screenshots cover the default palette. The custom draft was measured on style reference only; save, import, export, reset, and cross-route persistence were excluded because they mutate settings.
