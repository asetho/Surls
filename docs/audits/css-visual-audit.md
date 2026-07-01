# Surls CSS, Theme, and Visual-Style Audit

Date: 2026-07-01  
Branch: `audit/css-visual-preview`  
Preview source: `visual-audit-preview/src/`  
Static build: `visual-audit-preview/dist/`  
Local hosted preview: `http://127.0.0.1:4173/`  
Structured findings: `docs/audits/css-visual-findings.json`  
Machine-readable inventory: `docs/audits/css-visual-inventory.json`

## Executive Summary

The app has a coherent admin visual identity built around a blue/teal dashboard palette, compact controls, rounded panels, dense data tables, and a configurable light/dark dashboard theme. The biggest risk is not the visual direction; it is that the styling system grew organically into a large global stylesheet with theme metadata split across defaults, emitters, editor controls, and documentation.

This branch records the current behavior, adds a canonical dashboard theme-token registry, updates the style reference to document registry entries, exposes read-only compatibility tokens in the theme editor, adds read-only structural visual tokens, introduces shared dense-table variants, adds coverage tests so emitted dashboard variables, editor/reference coverage, responsive table contracts, and hard-coded visual exceptions cannot silently drift, and fixes the lowest-risk issues identified by the audit.

The standalone preview demonstrates proposed improvements without importing them into production styling.

## Safety Boundary

No production data was used. No commands, deployments, requests, health checks, SSH sessions, Docker commands, database commands, or configuration changes were made against `hmserv` or `mn`.

## Finding Counts

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 3 |
| Medium | 5 |
| Low | 2 |
| Informational | 2 |

| Category | Count |
| --- | ---: |
| Theme consistency | 2 |
| CSS health | 3 |
| Design tokens | 1 |
| Accessibility | 2 |
| Responsive behavior | 1 |
| Visual consistency | 2 |
| Inventory | 1 |

## Top-Priority Recommendations

1. Keep the canonical `DASHBOARD_THEME_TOKEN_REGISTRY` and coverage tests from this branch.
2. Keep the new global `prefers-reduced-motion` and `forced-colors` rules in future component work.
3. Keep standalone redirect fallback CSS derived from registry defaults instead of hard-coded duplicated palettes.
4. Keep the shared dense-table variants for link/user/token/click tables.
5. Keep structural tokens read-only until a focused migration can safely expose editable spacing, radius, and type controls.
6. Continue extracting `globals.css` by component family only after screenshot coverage is in place.

## Design-Token Inventory

Dashboard theme registry: 59 tokens.

| Token family | Count | Notes |
| --- | ---: | --- |
| Navigation | 6 | Sidebar, hover, text, muted, border, accent. |
| Surfaces and backgrounds | 11 | Page, panels, strong surfaces, text, links, overlay, placeholders, QR background, shadow color. |
| Buttons and controls | 26 | Buttons, danger states, pills, short URL pills, segmented controls, legacy graph-tab aliases. |
| Tables and data views | 6 | Chart and map colors. |
| Status and feedback | 9 | Success, error, and info toast tokens. |
| Borders and focus | 1 | Derived focus ring compatibility token. |

Structural token families are now documented in `src/lib/visual-tokens.ts` as read-only or derived values for typography, spacing, radius, controls, tables, shadows, motion, layers, and breakpoints.

## Hard-Coded-Value Inventory

The tracked baseline is in `docs/audits/css-hardcoded-exceptions.json`.

| Metric | Count |
| --- | ---: |
| Files with documented visual literals or inline styles | 7 |
| Color literals | 275 |
| Inline style attributes | 6 |
| `!important` declarations | 30 |

This is a baseline, not an endorsement. `tests/theme-token-coverage.test.ts` fails if these counts grow without documenting the exception.

## Theme Coverage Matrix

| Surface | Coverage |
| --- | --- |
| CSS variable emitters | Covered by registry and test. |
| Theme editor editable color fields | 51/51 editable dashboard tokens covered. |
| Theme editor read-only compatibility fields | 8/8 listed with reason. |
| Style reference token list | 59/59 dashboard tokens rendered from registry. |
| Saved theme compatibility | Preserved through `normalizeDashboardTheme`; missing/invalid values fall back to defaults. |
| Structural tokens | Documented as read-only/derived values; not fully editable yet. |

Theme-editor coverage: 100% for current dashboard color/compatibility token registry.  
Style-reference coverage: 100% for current dashboard color/compatibility token registry.  
Structural token families not yet editable: 8 intentionally read-only families.

## Component and Route Coverage Matrix

| Route or component | Audit status | Notes |
| --- | --- | --- |
| `/admin` | Source reviewed, represented in preview | Metrics, topbar, sidebar, dashboard density. |
| `/admin/links` | Source reviewed, previous browser evidence considered | Uses shared dense-table variant with stable timestamp, numeric, and action cells. |
| `/admin/links/[id]` | Source reviewed | Chart tabs, recent clicks, QR/modal surfaces. |
| `/admin/tools` | Local browser verified | Tools are grouped into tabs on this branch. |
| `/admin/users` | Source reviewed | Table, status badges, admin controls. |
| `/admin/settings` | Source reviewed | Theme editor entry, settings panels, inline style exceptions. |
| `/admin/style-reference` | Updated | Token registry renders all dashboard tokens. |
| `/admin/profile` | Source reviewed | Profile, timezone, passkeys, 2FA, backup codes. |
| `/bookmarklet` | Source reviewed | Embedded shell uses dashboard theme variables. |
| `/login`, `/login/2fa` | Source reviewed | Auth shell and form components. |

## Responsive Testing Matrix

| Viewport | Coverage |
| --- | --- |
| 375px mobile | Standalone preview screenshot captured. |
| 768px tablet | Standalone preview screenshot captured. |
| 1440px desktop | Standalone preview screenshot captured. |

The production app was not deployed or checked against production hosts. Local browser QA was limited to the branch preview and static review site.

Screenshot artifacts:

- `visual-audit-preview/screenshots/mobile-375.png`
- `visual-audit-preview/screenshots/tablet-768.png`
- `visual-audit-preview/screenshots/desktop-1440.png`
- `visual-audit-preview/screenshots/dark-mobile-375.png`
- `visual-audit-preview/screenshots/dark-tablet-768.png`
- `visual-audit-preview/screenshots/dark-desktop-1440.png`

## Accessibility Findings

- `prefers-reduced-motion` now disables nonessential transitions and animation.
- `forced-colors` now covers core controls, surfaces, tables, focus, and feedback primitives.
- The focus-ring token exists and now has a forced-colors system-color fallback.
- Muted and placeholder colors are themeable, but full contrast automation is not installed in this repository.
- Dense table and icon-action touch targets now use a shared sizing contract for the audited admin tables.

## CSS Maintenance Findings

- `src/app/globals.css` is the dominant styling surface at 5679 lines.
- New focused CSS layers were added for dense data tables and Theme Editor controls: `src/app/admin-data.css` and `src/app/admin-theme-editor.css`.
- The stylesheet contains 30 `!important` declarations, mostly compatibility overrides plus reduced-motion overrides.
- Static inline style exceptions were converted into named classes; remaining inline styles are data-driven chart positions or CSS-variable bridges.
- The redirect fallback document now derives its fallback colors from `DEFAULT_DASHBOARD_THEME`.

## Canonical Theme Token Registry

This branch adds `DASHBOARD_THEME_TOKEN_REGISTRY` in `src/lib/dashboard-theme.ts`. Each entry includes:

- Stable ID.
- Label.
- Category and subcategory.
- CSS custom property.
- Light and dark default values.
- Value type.
- Editor control type.
- Description.
- Scope.
- Example usage.
- Editable or read-only status.
- Read-only reason.
- Deprecated/replacement metadata.
- Fallback behavior.

The registry preserves saved-theme compatibility because the stored theme shape is unchanged and normalization still falls back to `DEFAULT_DASHBOARD_THEME`.

## Preview

The isolated preview is in `visual-audit-preview/` and demonstrates:

- Audit summary dashboard.
- Prioritized findings.
- Token inventory.
- Before-and-after examples.
- Component gallery.
- Route/screen gallery.
- Accessibility recommendations.
- Responsive presets for mobile, tablet, and desktop.
- Light/dark toggle.

Proposed styles are namespaced under `.audit-after` and are not imported by the production application.

## Limitations

- No production data was used.
- No production server was accessed.
- The repository does not include an installed automated accessibility scanner such as `axe-core`; accessibility checks were source-based and visual-preview based.
- The audit does not claim every possible authenticated runtime state was exercised in a live browser. It covers reachable source routes, local fixtures, and the static review site.
- Structural tokens are implemented as read-only documentation and tests rather than editable production controls.

## Implementation Sequence

1. Merge registry, coverage tests, reduced-motion, forced-colors, redirect fallback, and inline-style cleanup from this branch.
2. Keep static visual/a11y guards for reduced motion, forced colors, structural-token coverage, and responsive table contracts.
3. Keep shared dense-table variants on data-heavy pages.
4. Split more global CSS into layered files or component families.
5. Promote safe structural tokens to theme-editor controls gradually.
7. Remove deprecated graph-tab compatibility tokens only with an explicit migration plan.

## Findings

See `docs/audits/css-visual-findings.json` for the complete machine-readable finding set with IDs, severity, source line, preview anchors, production-impact notes, risk, and status.
