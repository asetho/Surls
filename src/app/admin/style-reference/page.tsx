import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Link2,
  Mail,
  Palette,
  Save,
  Search,
  Share2,
  Trash2
} from "lucide-react";
import { adminLoginPath } from "@/lib/admin-login-path";
import { requireSiteAdmin } from "@/lib/auth";
import { DASHBOARD_THEME_TOKEN_REGISTRY, type DashboardThemeKey } from "@/lib/dashboard-theme";
import { STRUCTURAL_VISUAL_TOKEN_CATEGORIES } from "@/lib/visual-tokens";
import { StyleReferenceInteractions } from "./StyleReferenceInteractions";

export const metadata: Metadata = {
  title: "Style Reference"
};

const typeSamples = [
  ["Display", "Short link analytics", "text"],
  ["Heading", "Dashboard theme controls", "text"],
  ["Body", "Create, search, copy, share, edit, disable, archive, and inspect links.", "text"],
  ["Mono", "Surls v1.11.0 git abc1234", "muted"]
] as const;

function tokenStyle(token: string) {
  if (token.endsWith("focus-ring")) {
    return {
      "--token-color": "var(--surface)",
      "--token-shadow": `var(${token})`
    } as CSSProperties;
  }

  return { "--token-color": `var(${token})` } as CSSProperties;
}

function themeField(field: DashboardThemeKey) {
  return field;
}

const tokenCategories = Array.from(new Set(DASHBOARD_THEME_TOKEN_REGISTRY.map((token) => token.category))).map((category) => ({
  category,
  tokens: DASHBOARD_THEME_TOKEN_REGISTRY.filter((token) => token.category === category)
}));

function ThemeTokenPanel() {
  return (
    <details className="surface surface-panel settings-collapse style-reference-token-panel">
      <summary className="settings-card-header">
        <h2>Theme tokens</h2>
        <span className="status-pill status-pill-active">Live palette</span>
      </summary>
      <div className="settings-collapse-body">
        <div className="style-reference-token-sections">
          {tokenCategories.map((section) => (
            <details className="settings-collapse style-reference-token-section" key={section.category}>
              <summary className="settings-card-header">
                <h3>{section.category}</h3>
                <span className="muted small">{section.tokens.length} tokens</span>
              </summary>
              <div className="settings-collapse-body style-reference-token-section-body">
                <div className="style-reference-token-grid">
                  {section.tokens.map((field) => {
                    const token = field.cssCustomProperty;
                    return (
                      <div
                        className="style-reference-token style-reference-theme-target"
                        data-theme-field={field.key}
                        key={token}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="style-reference-swatch" style={tokenStyle(token)} aria-hidden />
                        <span>
                          <strong>{field.label}</strong>
                          <code>{token}</code>
                          <small>{field.subcategory}</small>
                          <small>{field.description}</small>
                          <small>
                            {field.editable ? "Editable" : `Read-only: ${field.readOnlyReason}`}
                            {field.deprecated && field.replacementToken ? ` Replaced by ${field.replacementToken}.` : ""}
                          </small>
                          <small>
                            Defaults: light {field.defaultLightValue}, dark {field.defaultDarkValue}
                          </small>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </details>
  );
}

function StructuralTokenPanel() {
  return (
    <details className="surface surface-panel settings-collapse style-reference-token-panel">
      <summary className="settings-card-header">
        <h2>Structural tokens</h2>
        <span className="status-pill">Read-only</span>
      </summary>
      <div className="settings-collapse-body">
        <div className="style-reference-token-sections">
          {STRUCTURAL_VISUAL_TOKEN_CATEGORIES.map((section) => (
            <details className="settings-collapse style-reference-token-section" key={section.category}>
              <summary className="settings-card-header">
                <h3>{section.category}</h3>
                <span className="muted small">{section.tokens.length} tokens</span>
              </summary>
              <div className="settings-collapse-body style-reference-token-section-body">
                <div className="style-reference-token-grid">
                  {section.tokens.map((token) => (
                    <div className="style-reference-token" key={token.id}>
                      <span>
                        <strong>{token.label}</strong>
                        <code>{token.cssCustomProperty ?? token.id}</code>
                        <small>{token.valueType} / {token.scope}</small>
                        <small>{token.description}</small>
                        <small>Value: {token.value}</small>
                        <small>{token.exampleUsage}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </details>
  );
}

export default async function StyleReferencePage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/style-reference"));

  return (
    <main className="admin-content style-reference-page">
      <StyleReferenceInteractions />
      <div className="content-header content-header-topbar">
        <div>
          <h1>Style Reference</h1>
          <p className="muted">Review the saved dashboard theme across common admin interface elements.</p>
        </div>
        <div className="content-header-actions">
          <Link className="button secondary" href="/admin/style-reference?themeEditor=open">
            <Palette size={16} aria-hidden />
            Theme Editor
          </Link>
          <Link className="button secondary" href="/admin/settings">
            Back to Settings
          </Link>
        </div>
      </div>

      <section className="style-reference-grid">
        <div className="surface surface-panel">
          <h2>Type</h2>
          <div className="style-reference-type-list">
            {typeSamples.map(([label, text, field]) => (
              <div
                className="style-reference-theme-target"
                data-theme-field={field}
                key={label}
                role="button"
                tabIndex={0}
              >
                <span className="muted small">{label}</span>
                <p className={`style-reference-type-${label.toLowerCase()}`}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface surface-panel">
          <h2>Actions</h2>
          <div className="style-reference-button-grid">
            <button data-theme-field={themeField("accent")} type="button">
              <Save size={16} aria-hidden />
              Primary action
            </button>
            <button className="secondary" data-theme-field={themeField("surfaceStrong")} type="button">
              <Copy size={16} aria-hidden />
              Secondary
            </button>
            <button className="danger" data-theme-field={themeField("dangerBackground")} type="button">
              <Archive size={16} aria-hidden />
              Archive
            </button>
            <button className="danger-outline" data-theme-field={themeField("dangerBorder")} type="button">
              <Trash2 size={16} aria-hidden />
              Delete
            </button>
            <button className="icon-button secondary" data-theme-field={themeField("border")} type="button" aria-label="Share sample">
              <Share2 size={16} aria-hidden />
            </button>
          </div>
        </div>
      </section>

      <section className="style-reference-grid">
        <div className="surface surface-panel">
          <h2>Forms</h2>
          <form className="form-stack">
            <div className="form-grid">
              <label>
                Search
                <span className="input-with-icon">
                  <Search size={16} aria-hidden />
                  <input placeholder="Search links or tags" />
                </span>
              </label>
              <label>
                Sort
                <select defaultValue="newest">
                  <option value="newest">Newest</option>
                  <option value="short-url">Short URL A-Z</option>
                  <option value="clicks">Most clicks</option>
                </select>
              </label>
            </div>
            <label>
              Message
              <textarea placeholder="Add internal notes for this link." rows={3} />
            </label>
            <label className="inline-field">
              <input type="checkbox" defaultChecked />
              Track admin clicks
            </label>
          </form>
        </div>

        <div className="surface surface-panel">
          <h2>Pills and links</h2>
          <div className="style-reference-pill-row">
            <a className="short-url-pill" data-theme-field={themeField("shortUrlPillBackground")} href="#reference-short-url">
              qr-demo
            </a>
            <span className="badge style-reference-theme-target" data-theme-field={themeField("activePillBackground")} role="button" tabIndex={0}>Active</span>
            <span className="badge warning style-reference-theme-target" data-theme-field={themeField("dangerBackground")} role="button" tabIndex={0}>Disabled</span>
            <a className="badge tag-link" data-theme-field={themeField("pillBackground")} href="#reference-tag">
              Product
            </a>
            <span className="sort-badge style-reference-theme-target" data-theme-field={themeField("pillBackground")} role="button" tabIndex={0}>Sort</span>
            <span className="status-pill style-reference-theme-target" data-theme-field={themeField("pillBackground")} role="button" tabIndex={0}>Built-in</span>
            <span className="status-pill status-pill-active style-reference-theme-target" data-theme-field={themeField("activePillBackground")} role="button" tabIndex={0}>Custom</span>
          </div>
          <div className="style-reference-segmented-row">
            <span className="muted small">Segmented controls</span>
            <div
              className="segmented-control style-reference-theme-target"
              data-theme-field={themeField("segmentedControlBackground")}
            >
              <button
                type="button"
                className="segmented-control-option"
                aria-pressed="false"
                data-theme-field={themeField("segmentedControlText")}
              >
                L
              </button>
              <button
                type="button"
                className="segmented-control-option"
                aria-pressed="true"
                data-theme-field={themeField("segmentedControlActiveBackground")}
              >
                M
              </button>
              <button
                type="button"
                className="segmented-control-option"
                aria-pressed="false"
                data-theme-field={themeField("segmentedControlText")}
              >
                Q
              </button>
              <button
                type="button"
                className="segmented-control-option"
                aria-pressed="false"
                data-theme-field={themeField("segmentedControlText")}
              >
                H
              </button>
            </div>
          </div>
          <p>
            <a data-theme-field={themeField("link")} href="#reference-link">
              <ExternalLink size={13} aria-hidden />
              https://example.com/surls-theme
            </a>
          </p>
        </div>
      </section>

      <section className="surface surface-panel">
        <div className="content-header">
          <div>
            <h2>Tables and stats</h2>
            <p className="muted">Rows, badges, icon buttons, responsive table behavior, and metric cards.</p>
          </div>
          <div className="row-actions">
            <button className="secondary icon-button" type="button">
              <Link2 size={16} aria-hidden />
              QR code
            </button>
            <button className="secondary icon-button" type="button">
              <Mail size={16} aria-hidden />
              Share
            </button>
          </div>
        </div>
        <section className="grid-3 dashboard-metrics">
          <div className="metric">
            <span className="muted">Total clicks</span>
            <strong>1,559</strong>
          </div>
          <div className="metric">
            <span className="muted">Unique visits</span>
            <strong>1,204</strong>
          </div>
          <div className="metric">
            <span className="muted">Last clicked</span>
            <strong>06/17/26 2:12 PM</strong>
          </div>
        </section>
        <div className="table-wrap">
          <table className="data-table data-table-dense responsive-table">
            <thead>
              <tr>
                <th>Short URL</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Clicks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Short URL">
                  <a className="short-url-pill" href="#reference-table-link">github</a>
                </td>
                <td data-label="Destination">
                  <a href="#reference-destination">https://github.com/</a>
                </td>
                <td data-label="Status">
                  <span className="badge">Active</span>
                </td>
                <td className="data-table-numeric" data-label="Clicks">1,559</td>
                <td className="data-table-actions" data-label="Actions">
                  <div className="row-actions small">
                    <button className="icon-button secondary" type="button" aria-label="Copy sample">
                      <Copy size={15} aria-hidden />
                    </button>
                    <button className="icon-button secondary" type="button" aria-label="Share sample">
                      <Share2 size={15} aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td data-label="Short URL">
                  <a className="short-url-pill" href="#reference-table-disabled">disabled-demo</a>
                </td>
                <td data-label="Destination">
                  <a href="#reference-disabled-destination">https://example.com/disabled</a>
                </td>
                <td data-label="Status">
                  <span className="badge warning">Disabled</span>
                </td>
                <td className="data-table-numeric" data-label="Clicks">270</td>
                <td className="data-table-actions" data-label="Actions">
                  <div className="row-actions small">
                    <button className="icon-button secondary" type="button" aria-label="Copy disabled sample">
                      <Copy size={15} aria-hidden />
                    </button>
                    <button className="icon-button secondary" type="button" aria-label="Share disabled sample">
                      <Share2 size={15} aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface surface-panel">
        <h2>Tabs, graphs, and maps</h2>
        <div
          className="tab-list style-reference-theme-target"
          role="tablist"
          aria-label="Reference tabs"
          data-theme-field={themeField("segmentedControlBackground")}
          tabIndex={0}
        >
          <button
            className="tab-button style-reference-theme-target"
            type="button"
            role="tab"
            aria-selected="true"
            data-theme-field={themeField("segmentedControlActiveBackground")}
          >
            Historical clicks
          </button>
          <button
            className="tab-button style-reference-theme-target"
            type="button"
            role="tab"
            aria-selected="false"
            data-theme-field={themeField("segmentedControlText")}
          >
            Location
          </button>
          <button
            className="tab-button style-reference-theme-target"
            type="button"
            role="tab"
            aria-selected="false"
            data-theme-field={themeField("segmentedControlText")}
          >
            Sources
          </button>
          <button
            className="tab-button style-reference-theme-target"
            type="button"
            role="tab"
            aria-selected="false"
            data-theme-field={themeField("segmentedControlText")}
          >
            Browser/device
          </button>
        </div>
        <div className="style-reference-viz-grid">
          <div className="style-reference-chart-card style-reference-theme-target" data-theme-field={themeField("chartPrimary")} role="button" tabIndex={0}>
            <h3>Line chart</h3>
            <svg className="style-reference-line-chart" viewBox="0 0 520 220" role="img" aria-label="Sample line chart">
              <line x1="46" y1="34" x2="486" y2="34" />
              <line x1="46" y1="82" x2="486" y2="82" />
              <line x1="46" y1="130" x2="486" y2="130" />
              <line x1="46" y1="178" x2="486" y2="178" />
              <polygon points="46,178 88,144 130,172 176,154 226,96 276,134 322,110 370,154 420,62 486,128 486,178 46,178" />
              <polyline points="46,178 88,144 130,172 176,154 226,96 276,134 322,110 370,154 420,62 486,128" />
              <circle cx="420" cy="62" r="5" />
            </svg>
          </div>
          <div className="style-reference-chart-card style-reference-theme-target" data-theme-field={themeField("chartPiePrimary")} role="button" tabIndex={0}>
            <h3>Pie chart</h3>
            <div className="style-reference-pie" aria-label="Sample pie chart" role="img" />
            <div className="style-reference-chart-list">
              <div>
                <span>Direct</span>
                <strong>62%</strong>
              </div>
              <div>
                <span>Social</span>
                <strong>24%</strong>
              </div>
            </div>
          </div>
          <div className="style-reference-chart-card style-reference-theme-target" data-theme-field={themeField("chartMapHigh")} role="button" tabIndex={0}>
            <h3>Map colors</h3>
            <div className="style-reference-map" aria-label="Sample map color buckets" role="img">
              <span className="bucket-1" />
              <span className="bucket-2" />
              <span className="bucket-3" />
              <span className="bucket-4" />
              <span className="bucket-5" />
            </div>
            <div className="style-reference-map-legend">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </div>
      </section>

      <section className="style-reference-grid">
        <div className="surface surface-panel">
          <h2>Notices and toasts</h2>
          <div className="style-reference-toast-stack">
            <div className="style-reference-toast style-reference-toast-success style-reference-theme-target" data-theme-field={themeField("toastSuccessBackground")} role="button" tabIndex={0}>
              <CheckCircle2 size={18} aria-hidden />
              <span>Dashboard theme saved.</span>
            </div>
            <div className="style-reference-toast style-reference-toast-error style-reference-theme-target" data-theme-field={themeField("toastErrorBackground")} role="button" tabIndex={0}>
              <AlertTriangle size={18} aria-hidden />
              <span>Could not save dashboard theme.</span>
            </div>
            <div className="style-reference-toast style-reference-toast-info style-reference-theme-target" data-theme-field={themeField("toastInfoBackground")} role="button" tabIndex={0}>
              <Info size={18} aria-hidden />
              <span>Settings saved.</span>
            </div>
          </div>
        </div>

        <div className="surface surface-panel">
          <h2>Empty states</h2>
          <div className="style-reference-empty-state style-reference-theme-target" data-theme-field={themeField("surfaceStrong")} role="button" tabIndex={0}>
            <Info size={22} aria-hidden />
            <strong>No links yet</strong>
            <p className="muted">Create your first short URL to populate this area.</p>
            <button type="button">Create Link</button>
          </div>
        </div>
      </section>

      <ThemeTokenPanel />
      <StructuralTokenPanel />
    </main>
  );
}
