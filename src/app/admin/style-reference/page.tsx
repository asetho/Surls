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
import { DASHBOARD_THEME_FIELD_SECTIONS } from "@/lib/dashboard-theme";

export const metadata: Metadata = {
  title: "Style Reference"
};

const typeSamples = [
  ["Display", "Short link analytics"],
  ["Heading", "Dashboard theme controls"],
  ["Body", "Create, search, copy, share, edit, disable, archive, and inspect links."],
  ["Mono", "Surls v1.11.0 git abc1234"]
] as const;

function fieldKeyToToken(key: string) {
  return `--dashboard-active-${key.replace(/[A-Z]/g, "-$&").toLowerCase()}`;
}

function tokenStyle(token: string) {
  if (token.endsWith("focus-ring")) {
    return {
      "--token-color": "var(--surface)",
      "--token-shadow": `var(${token})`
    } as CSSProperties;
  }

  return { "--token-color": `var(${token})` } as CSSProperties;
}

export default async function StyleReferencePage() {
  const admin = await requireSiteAdmin();
  if (!admin) redirect(adminLoginPath("/admin/style-reference"));

  return (
    <main className="admin-content style-reference-page">
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

      <section className="surface surface-panel">
        <div className="settings-card-header">
          <h2>Theme tokens</h2>
          <span className="status-pill status-pill-active">Live palette</span>
        </div>
        <div className="style-reference-token-sections">
          {DASHBOARD_THEME_FIELD_SECTIONS.map((section) => (
            <div className="style-reference-token-section" key={section.key}>
              <h3>{section.label}</h3>
              <div className="style-reference-token-grid">
                {section.fields.map((field) => {
                  const token = fieldKeyToToken(field.key);
                  return (
                    <div className="style-reference-token" key={token}>
                      <span className="style-reference-swatch" style={tokenStyle(token)} aria-hidden />
                      <span>
                        <strong>{field.label}</strong>
                        <code>{token}</code>
                        <small>{field.description}</small>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="style-reference-grid">
        <div className="surface surface-panel">
          <h2>Type</h2>
          <div className="style-reference-type-list">
            {typeSamples.map(([label, text]) => (
              <div key={label}>
                <span className="muted small">{label}</span>
                <p className={`style-reference-type-${label.toLowerCase()}`}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface surface-panel">
          <h2>Actions</h2>
          <div className="style-reference-button-grid">
            <button type="button">
              <Save size={16} aria-hidden />
              Primary action
            </button>
            <button className="secondary" type="button">
              <Copy size={16} aria-hidden />
              Secondary
            </button>
            <button className="danger" type="button">
              <Archive size={16} aria-hidden />
              Archive
            </button>
            <button className="danger-outline" type="button">
              <Trash2 size={16} aria-hidden />
              Delete
            </button>
            <button className="icon-button secondary" type="button" aria-label="Share sample">
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
            <a className="short-url-pill" href="#reference-short-url">
              qr-demo
            </a>
            <span className="badge">Active</span>
            <span className="badge warning">Disabled</span>
            <a className="badge tag-link" href="#reference-tag">
              Product
            </a>
            <span className="sort-badge">Sort</span>
            <span className="status-pill">Built-in</span>
            <span className="status-pill status-pill-active">Custom</span>
          </div>
          <p>
            <a href="#reference-link">
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
          <table className="responsive-table">
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
                <td data-label="Clicks">1,559</td>
                <td data-label="Actions">
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
                <td data-label="Clicks">270</td>
                <td data-label="Actions">
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
        <div className="tab-list" role="tablist" aria-label="Reference tabs">
          <button className="tab-button" type="button" role="tab" aria-selected="true">
            Historical clicks
          </button>
          <button className="tab-button" type="button" role="tab" aria-selected="false">
            Location
          </button>
          <button className="tab-button" type="button" role="tab" aria-selected="false">
            Sources
          </button>
          <button className="tab-button" type="button" role="tab" aria-selected="false">
            Browser/device
          </button>
        </div>
        <div className="style-reference-viz-grid">
          <div className="style-reference-chart-card">
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
          <div className="style-reference-chart-card">
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
          <div className="style-reference-chart-card">
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
            <div className="style-reference-toast style-reference-toast-success">
              <CheckCircle2 size={18} aria-hidden />
              <span>Dashboard theme saved.</span>
            </div>
            <div className="style-reference-toast style-reference-toast-error">
              <AlertTriangle size={18} aria-hidden />
              <span>Could not save dashboard theme.</span>
            </div>
            <div className="success">
              <Info size={18} aria-hidden />
              Settings saved.
            </div>
            <div className="error">
              <AlertTriangle size={18} aria-hidden />
              Upload failed.
            </div>
          </div>
        </div>

        <div className="surface surface-panel">
          <h2>Empty states</h2>
          <div className="style-reference-empty-state">
            <Info size={22} aria-hidden />
            <strong>No links yet</strong>
            <p className="muted">Create your first short URL to populate this area.</p>
            <button type="button">Create Link</button>
          </div>
        </div>
      </section>
    </main>
  );
}
