# Surls visual QA audit

2026-09-29 · Local preview `http://127.0.0.1:3000` · Codex in-app Chromium browser · **Partial audit**

## Executive summary

This report records the original audit snapshot. The local fix and warning-scan results are in the follow-up below.

The default homepage and most admin pages have a consistent Surls palette, readable layout, and working mobile navigation. The visual release gate remains open: the dashboard's Share action breaks at tablet width, the links table loses destination information at laptop width, and dark danger buttons miss normal-text contrast. Authentication pages, Safari/WebKit, browser zoom, and saved custom themes need separate coverage before a full visual sign-off.

Source inventory found **17 HTML/UI route families**: 12 primary public/admin pages, one theme-editor redirect, and four sign-in/2FA/development pages. **13 intended surfaces** were opened and rendered (the 12 primary pages plus theme editor); **9 passed the inspected states, 3 failed, 1 was partial, and 4 were blocked for their intended UI**. Additional 404 and two 410 states were rendered. Public redirect and resource handlers are listed in the [route matrix](route-matrix.md). **108 screenshots** are saved; the main 12 pages have light/dark captures at 390×844 and 1440×900. Five complex pages also have 375×812, 430×932, 768×1024, 1024×768, and 1920×1080 light captures. Only Chromium was available. This is viewport emulation, not a physical-device or WebKit run.

The audit inspection itself was read-only. After the audit request, the user separately asked for a single cycling homepage theme button; that scoped source/test change was made and verified. F04 was subsequently fixed locally in a separate, user-requested follow-up. No production system, data, deployment, Git history, or remote service was changed.

## Top 10 issues

| Rank | ID | Severity | What users see |
| --- | --- | --- | --- |
| 1 | F01 | High | Dashboard Share action collapses and wraps vertically at 768 px. |
| 2 | F02 | High | Dark danger button text fails 4.5:1 contrast. |
| 3 | F03 | High | Links table truncates destination names and URLs to fragments at 1024 px. |
| 4 | F04 | Medium | Link detail logged duplicate React key `000`; fixed locally after the audit. |
| 5 | F05 | Medium | Invalid-route page provides no way back to the app. |
| 6 | F06 | Medium | Invalid-route page shows a development issue badge and a script-render warning. |
| 7 | F07 | Medium | Structural control-height reference disagrees with live CSS. |
| 8 | F08 | Low | Disabled/expired public pages stay dark under a light preference. |
| 9 | F09 | Low | Several dense icon actions are about 38 px square, below a 44 px comfort target. |
| 10 | F10 | Polish | New-link modal actions initially sit below the fold on a 390 px mobile viewport. |

## Fix and warning-scan follow-up · 2026-09-29

All ten numbered findings have local fixes. F04's chart-key and hydration fixes were completed in the earlier follow-up; F01–F03 and F05–F10 were addressed in this pass. At 768 px, dashboard Copy/Share actions remain readable. At 1024 px, the links heading, destinations, and actions remain visible. The dark danger controls now meet normal-text contrast in the checked default theme. The 404 has recovery links and no development issue badge. The structural token matches live CSS; unavailable pages follow the public theme choice; mobile icon targets measure 44×44 px; and the new-link modal keeps its actions visible at 390 px.

Fresh Chromium navigations to the homepage, dashboard, links, populated link detail, tools, users, settings, email settings, Style Reference, and profile produced no console errors or warnings. The 404 and light/dark 410 pages also rendered without console warnings. Expanding the Style Reference structural tokens also exposed a stale icon-action size, which was aligned with the current 34 px desktop and 44 px mobile targets. `npm run lint`, `npm test` (687 tests), `npx tsc --noEmit --incremental false`, `npm run build`, and `git diff --check` passed. The test runner still prints a Vite configuration compatibility warning for `vitest.config.ts`, and the build prints Node Web Crypto experimental warnings during page-data collection. Those toolchain warnings did not fail either command and were not part of the visual findings.

The original coverage limits below still apply to signed-out authentication states, WebKit/Safari, browser zoom, saved custom themes, and physical devices. No production system or remote service was changed.

## Findings by severity

Each finding includes the observed viewport, theme and state; the browser was Chromium unless stated otherwise. “Fix now/later” is a recommendation, not an implemented change.

### F01 — Dashboard Share action wraps vertically

**High · Confirmed · Responsive layout · `/admin` · 768×1024 · light · top-link cards · high confidence.** The Share button shrinks to a narrow column and its letters wrap vertically, making the action hard to identify and tap. Open `/admin` at 768×1024 and inspect the Top links actions. [Screenshot](screenshots/dashboard__768x1024__light__default.jpg); source: `src/app/admin-data.css:425-440` and dashboard action markup. The page has no document-level horizontal overflow, so an overflow-only check misses this failure. **Fix now; low-to-medium risk:** let action controls use their intrinsic width or a stacked full-width action row at this breakpoint, then recheck other table/card actions.

### F02 — Dark danger contrast

**High · Confirmed · Accessibility/theme · `/admin/style-reference` · 1440×900 and 390×844 · dark · action samples · high confidence.** Computed styles show white normal-size text on `#e65057` at about **3.72:1**, and outline text `#e65057` on `#0c354b` at about **3.47:1**. Both are below 4.5:1 for WCAG AA normal text. Open Style Reference in dark mode and inspect Archive/Delete. [Screenshot](screenshots/style-reference__1440x900__dark__default.jpg), [computed samples](computed-style-samples.json); source: `src/lib/dashboard-theme.ts:294-296`, `src/app/globals.css:180-202`. **Fix now; low-to-medium risk:** tune the dark danger foreground/background pair and verify hover, badges, toasts, and disabled states before changing shared tokens.

### F03 — Links lose destination context at laptop width

**High · Confirmed · Responsive/table density · `/admin/links` · 1024×768 · light · active list · high confidence.** Destination labels and URLs display only a few characters, while the Active links heading and result count wrap awkwardly. Open the active links page at 1024×768. [Screenshot](screenshots/links__1024x768__light__default.jpg); source: `src/app/admin-data.css:106-147` fixed column widths. Users cannot scan where links point. **Fix now; medium risk:** rebalance or collapse columns at this width, keeping destination text readable and actions reachable.

### F04 — Duplicate chart key on link detail

**Medium · Confirmed in audit, resolved locally in follow-up · Console/render integrity · `/admin/links/[id]` · 390×844 and 1440×900 · both themes · populated analytics · high confidence.** Opening the seeded detail page logged React's duplicate key `000` warning. The exact source is `WorldTrafficMap` in `src/components/LocationCharts.tsx`: the bundled atlas has separate N. Cyprus, Somaliland, and Kosovo features that all use numeric ID `000`, while each map path used that ID alone as its React key. [Audit screenshot](screenshots/link-detail__1440x900__light__default.jpg), [browser observations](browser-observations.json). **Follow-up fix:** each path now uses its country ID plus its stable atlas position. The populated Location tab rendered 177 map paths after the change. The follow-up also rounded chart coordinates in `LocationCharts` and `DistributionCharts` to resolve the chart hydration warning. A fresh browser tab had no console warnings or errors after visiting both Location and Browser/device tabs.

### F05 — 404 recovery gap

**Medium · Confirmed · Navigation/content · invalid admin detail · 390×844 and 1440×900 · light · 404 state · high confidence.** The page presents “Not found” and a short explanation but no Home, Dashboard, or Back action. Open `/admin/links/visual-qa-missing`. [Screenshot](screenshots/not-found__390x844__light__default.jpg); source: `src/app/not-found.tsx`. **Fix soon; low risk:** add a clear safe return link suited to public and admin contexts.

### F06 — 404 developer issue badge and script warning

**Medium · Confirmed in development · Console/error presentation · invalid admin detail · 390×844 · light · 404 state · high confidence for local dev, unknown for production.** The local 404 displays a red “1 Issue” development badge; console logs “Encountered a script tag while rendering React component.” The badge is visible in the [screenshot](screenshots/not-found__390x844__light__default.jpg); warning recorded in [browser observations](browser-observations.json). This could distract preview reviewers and may indicate a rendering path worth correcting. **Fix soon; medium risk:** inspect how the default homepage script is inserted in the root layout and test a production build before assigning production impact.

### F07 — Structural token documentation is out of sync

**Medium · Confirmed by code and computed style · Design system · Style Reference structural tokens · desktop/light · high confidence.** `src/lib/visual-tokens.ts:119-125` describes `--control-height` as `2.58rem`, while `src/app/globals.css:32` sets it to `2.12rem`. The read-only token panel therefore cannot be trusted as an exact description of controls. [Style Reference screenshot](screenshots/style-reference__1440x900__light__default.jpg). **Fix soon; low risk:** derive panel values from the actual custom properties or align the registry and CSS after measuring the intended control size.

### F08 — Public unavailable pages ignore light appearance

**Low · Confirmed · Theme consistency · `/disabled-demo`, `/expired-demo` · 390×844 and 1440×900 · light preference · 410 state · high confidence.** These pages render a fixed dark card even while the homepage is in light mode. [Screenshot](screenshots/unavailable-disabled__390x844__fixed-dark__default.jpg). The content is legible, so this is a consistency decision rather than a blocker. **Fix later; low risk:** either inherit the public theme or make the dark treatment an intentional documented exception.

### F09 — Dense icon-action targets

**Low · Confirmed · Touch usability · `/admin/links` and mobile menu · 390×844 · light/dark · action rows · medium confidence.** QR/row icon controls measured about 38×38 px; the mobile drawer close label was about 32×32 px. [Links screenshot](screenshots/links__390x844__light__default.jpg), [menu screenshot](screenshots/dashboard__430x932__light__mobile-menu-open.jpg). These are above WCAG 2.5.8's 24×24 minimum in the measured examples; this is a comfort and spacing recommendation, not a claimed WCAG failure. **Fix later; medium risk:** enlarge hit areas while retaining compact table density.

### F10 — New-link actions start below the fold

**Polish · Confirmed · Dialog discoverability · `/admin` Shorten URL modal · 390×844 · light · modal open · high confidence.** At the initial scroll position the internal notes and submit actions are below the viewport. Tabbing to the Create Link action scrolls it into view, so the workflow is reachable. [Initial screenshot](screenshots/dashboard__390x844__light__new-url-modal.jpg), [actions-visible screenshot](screenshots/dashboard__390x844__light__new-url-actions-visible.jpg). **Polish later; low-to-medium risk:** indicate that the form scrolls or keep the footer actions visible if it does not obscure fields.

## Route, responsive, browser, and theme evidence

- [Route testing matrix](route-matrix.md): each discovered UI route, access/seed requirement, light/dark coverage, console/network status, result, and blocked routes.
- [Responsive matrix](responsive-matrix.md): route × viewport screenshots, loaded/overflow results, special interaction states, and zoom limitation.
- [Theme coverage matrix](theme-coverage-matrix.md): light/dark/custom scope, editor behavior, and structural token mismatch.
- [Browser observations](browser-observations.json) and [computed style samples](computed-style-samples.json): settled browser measurements. The observations file includes expected 404/410 traffic and repeated detail-chart warnings; only screenshots present in the screenshots folder should be treated as valid captures.

| Engine | Device mode | Routes/states | Result | Limitation |
| --- | --- | --- | --- | --- |
| Chromium in-app browser | Desktop 1024–1920 px | 12 primary pages; 404/410; editor | 2 responsive failures, 1 detail warning | Local dev build; no production parity claim. |
| Chromium in-app browser | Mobile/tablet 375–768 px | 12 primary pages at 390; five complex pages across all widths | 768 dashboard failure | Viewport emulation, not physical hardware. |
| WebKit/Safari | — | None | Blocked | Engine unavailable in this browser session. |
| Firefox | — | None | Not configured/tested | No project E2E engine configured. |

## Design system and style-reference assessment

The admin token registry covers sidebar, panels/text, buttons/pills, charts/maps, and toasts; structural tokens cover type, spacing, controls, radius, table, shadow, motion, focus, and layers. Computed style samples were checked for body, sidebar, panels, links, buttons, fields, pills, and muted text in light/dark. Primary button contrast was about 7.33:1 light and 8.27:1 dark. No unused-token claim is made: this audit did not perform a complete static usage proof. The public homepage uses separate inline tokens and a separate theme preference; this is documented in README but not editable in the admin Theme Editor. No hard-coded values were changed during the audit.

The Style Reference includes type, actions, forms, pills/links, tables/stats, tabs/charts/maps, notices/toasts, empty states, theme tokens, and structural tokens. It is useful for palette comparison. It does not exercise the complete states of actual create/edit dialogs, field validation, loading, or saved-theme persistence. The live draft Short URL pill color changed as expected and was restored without saving. See [theme coverage](theme-coverage-matrix.md).

## Accessibility and interaction summary

Keyboard focus was visible on the homepage theme control and mobile menu trigger. Space activated the new homepage theme button. The mobile menu opened at 430 px and the style-reference desktop sidebar stayed at viewport top after scrolling. The new-link dialog remained keyboard reachable when its action footer was below the fold. The dashboard Copy action produced a single `role=status` / polite-live toast: [screenshot](screenshots/dashboard__390x844__light__copy-toast.jpg). QR dialog images loaded at their expected 300×300 intrinsic size: [screenshot](screenshots/links__390x844__dark__qr-dialog.jpg). No persistent success/error assertion is made for unsubmitted forms. Reduced-motion CSS exists in source; actual reduced-motion emulation was not run. Screen-reader announcement quality, full focus trap/return, field error messaging, and 125% zoom remain unverified.

## Console, network, and asset summary

The 12 primary pages loaded their main content without document-level horizontal overflow or broken images in the recorded baseline captures. No unexpected network failures appeared in settled captures, except expected 404/410 responses on error routes. Detail analytics produced the duplicate-key warning at audit time (fixed locally in the follow-up); the invalid detail route produced the script-render warning and development issue badge. The initial QR dialog capture preceded image load and was removed; the retained QR capture shows loaded images. Repeated or suspicious requests were not established by this pass; network checks were response/failure oriented rather than a performance waterfall audit.

## Blocked and untested work

| Area | Why | Needed to complete |
| --- | --- | --- |
| Login, login 2FA, admin 2FA | Existing signed-in preview session redirected to `/admin`. | Isolated signed-out browser profile and safe test credentials. |
| `/login-dev` | Local preview returned 404. | Enable the documented development preview flag in a disposable environment. |
| Public unknown path | Browser client blocked direct navigation. | Recheck in a standard browser; admin invalid-detail 404 UI was rendered. |
| Active short-code redirect | Would leave local preview and may record a click. | Disposable local redirect fixture and permission to exercise it. |
| Saved custom theme, import/export/reset | These mutate site settings. | Dedicated disposable settings fixture. |
| Create/edit/delete, SMTP, account changes | Form submission or external effects were outside read-only audit scope. | Safe test data and explicit workflow scope. |
| Empty fresh-install dashboard | Current preview is populated. | Separate fresh-install fixture. |
| Desktop sidebar collapsed, dropdown-open, loading, form-validation states | No safe distinct state or deterministic trigger was available in this read-only walkthrough; the mobile drawer and several alerts were inspected. | Add isolated interaction fixtures and capture each state. |
| Other roles and permission-restricted views | Preview session had one site-admin role. | Safe accounts for each supported role. |
| WebKit/Safari, Firefox, physical devices | Not available in current in-app browser session. | Browser/device access. |
| 90%, 110%, 125% zoom | Browser shortcut attempt did not change zoom or layout metrics. | Browser with controllable zoom. |
| Build, production rendering | Build script generates Prisma client and build output; audit targeted running local preview. | Disposable build workspace if required. |

## Suggested fix order

1. **Fix immediately:** F01, F02, F03. Each affects visible actions or legibility. F02 requires checking all uses of the shared danger token; F01/F03 need neighboring breakpoint checks.
2. **Fix soon:** F05–F07. The 404 experience and structural-token drift have limited but real quality impact. F04 was fixed locally after this audit; test production 404 rendering before treating F06 as production-facing.
3. **Polish later:** F08–F10. Decide intended unavailable-page theme behavior and target sizing before editing shared controls.

## Commands and change boundary

| Check | Result |
| --- | --- |
| `npx eslint src/lib/default-homepage.ts tests/root-route.test.ts` | Passed. |
| `npm run lint` | Passed. |
| `npx tsc --noEmit --incremental false` | Passed. |
| `npx vitest run tests/root-route.test.ts` | Passed, 3 tests. Initial run failed on the old three-button assertion; test updated for the separately requested switcher and current palette, then passed. |
| `npx vitest run tests/dashboard-theme.test.ts tests/theme-token-coverage.test.ts --reporter=dot` | Passed, 15 tests. |
| `npx vitest run tests/dashboard-theme.test.ts tests/theme-token-coverage.test.ts tests/visual-system-a11y.test.ts` | 1 pre-existing assertion failure: expected mobile drawer width `min(17rem, 76vw)` while the current CSS uses `min(14rem, 68vw)` from earlier user work. The unrelated test was not changed. |
| `git diff --check` | Passed at report creation. |

The product-source changes made across these requests are the user-requested homepage theme switcher in `src/lib/default-homepage.ts`, its route test in `tests/root-route.test.ts`, and the later chart fixes in `src/components/LocationCharts.tsx` and `src/components/DistributionCharts.tsx`. Pre-existing work in other files was preserved. Audit artifacts are confined to this folder. No commit, push, deployment, or production-data mutation occurred.
