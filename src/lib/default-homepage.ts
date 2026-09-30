function lucideIcon(name: string, nodes: string[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name} lucide-icon" aria-hidden="true" focusable="false">${nodes.join("")}</svg>`;
}

// Official Lucide SVG geometry, inlined because this route returns HTML rather than a React tree.
const ICONS = {
  analytics: lucideIcon("chart-column", [
    '<path d="M3 3v16a2 2 0 0 0 2 2h16"></path>',
    '<path d="M18 17V9"></path>',
    '<path d="M13 17V5"></path>',
    '<path d="M8 17v-3"></path>'
  ]),
  arrowDown: lucideIcon("arrow-down", [
    '<path d="M12 5v14"></path>',
    '<path d="m19 12-7 7-7-7"></path>'
  ]),
  externalLink: lucideIcon("external-link", [
    '<path d="M15 3h6v6"></path>',
    '<path d="M10 14 21 3"></path>',
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>'
  ]),
  key: lucideIcon("key-round", [
    '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"></path>',
    '<circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle>'
  ]),
  link: lucideIcon("link-2", [
    '<path d="M9 17H7A5 5 0 0 1 7 7h2"></path>',
    '<path d="M15 7h2a5 5 0 1 1 0 10h-2"></path>',
    '<line x1="8" x2="16" y1="12" y2="12"></line>'
  ]),
  login: lucideIcon("log-in", [
    '<path d="m10 17 5-5-5-5"></path>',
    '<path d="M15 12H3"></path>',
    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>'
  ]),
  monitor: lucideIcon("monitor", [
    '<rect width="20" height="14" x="2" y="3" rx="2"></rect>',
    '<line x1="8" x2="16" y1="21" y2="21"></line>',
    '<line x1="12" x2="12" y1="17" y2="21"></line>'
  ]),
  moon: lucideIcon("moon", [
    '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path>'
  ]),
  qrCode: lucideIcon("qr-code", [
    '<rect width="5" height="5" x="3" y="3" rx="1"></rect>',
    '<rect width="5" height="5" x="16" y="3" rx="1"></rect>',
    '<rect width="5" height="5" x="3" y="16" rx="1"></rect>',
    '<path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>',
    '<path d="M21 21v.01"></path>',
    '<path d="M12 7v3a2 2 0 0 1-2 2H7"></path>',
    '<path d="M3 12h.01"></path>',
    '<path d="M12 3h.01"></path>',
    '<path d="M12 16v.01"></path>',
    '<path d="M16 12h1"></path>',
    '<path d="M21 12v.01"></path>',
    '<path d="M12 21v-1"></path>'
  ]),
  sun: lucideIcon("sun", [
    '<circle cx="12" cy="12" r="4"></circle>',
    '<path d="M12 2v2"></path>',
    '<path d="M12 20v2"></path>',
    '<path d="m4.93 4.93 1.41 1.41"></path>',
    '<path d="m17.66 17.66 1.41 1.41"></path>',
    '<path d="M2 12h2"></path>',
    '<path d="M20 12h2"></path>',
    '<path d="m6.34 17.66-1.41 1.41"></path>',
    '<path d="m19.07 4.93-1.41 1.41"></path>'
  ]),
  upload: lucideIcon("upload", [
    '<path d="M12 3v12"></path>',
    '<path d="m17 8-5-5-5 5"></path>',
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>'
  ])
};

const DEFAULT_HOMEPAGE_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta id="theme-color" name="theme-color" content="#f2f5f7" />
    <link rel="icon" href="/brand/surls-app-icon-80.png" type="image/png" sizes="80x80" />
    <link rel="apple-touch-icon" href="/brand/surls-app-icon-180.png" sizes="180x180" />
    <meta
      name="description"
      content="Surls is a private short-link system for managing redirects, uploads, QR codes, and privacy-aware click analytics."
    />
    <title>Surls — Short links under your control</title>
    <script>
      (() => {
        const storageKey = "surls-home-theme";
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
        const validThemes = new Set(["auto", "light", "dark"]);
        const themeOrder = ["light", "auto", "dark"];
        const themeLabels = { light: "Light", auto: "System", dark: "Dark" };

        const readTheme = () => {
          try {
            const storedTheme = localStorage.getItem(storageKey);
            return storedTheme && validThemes.has(storedTheme) ? storedTheme : "auto";
          } catch {
            return "auto";
          }
        };

        const applyTheme = (preference, persist = false) => {
          const theme = preference === "auto" ? (systemTheme.matches ? "dark" : "light") : preference;
          const root = document.documentElement;
          root.dataset.theme = theme;
          root.dataset.themeChoice = preference;
          root.style.colorScheme = theme;

          const themeColor = document.querySelector("#theme-color");
          if (themeColor) {
            themeColor.setAttribute("content", theme === "dark" ? "#061d2b" : "#f2f5f7");
          }

          if (persist) {
            try {
              if (preference === "auto") {
                localStorage.removeItem(storageKey);
              } else {
                localStorage.setItem(storageKey, preference);
              }
            } catch {
              // The selected theme still applies when storage is unavailable.
            }
          }
          document.cookie = storageKey + "=" + preference + "; path=/; max-age=31536000; samesite=lax";

          const button = document.querySelector("[data-theme-cycle]");
          if (button) {
            const next = themeOrder[(themeOrder.indexOf(preference) + 1) % themeOrder.length];
            const label = "Color theme: " + themeLabels[preference] + ". Switch to " + themeLabels[next] + ".";
            button.setAttribute("aria-label", label);
            button.title = label;
            button.querySelectorAll("[data-theme-icon]").forEach((icon) => {
              icon.hidden = icon.dataset.themeIcon !== preference;
            });
          }
        };

        applyTheme(readTheme());

        document.addEventListener("DOMContentLoaded", () => {
          document.querySelector("[data-theme-cycle]")?.addEventListener("click", () => {
            const current = document.documentElement.dataset.themeChoice || "auto";
            const next = themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length];
            applyTheme(next, true);
          });
          applyTheme(document.documentElement.dataset.themeChoice || "auto");
        }, { once: true });

        systemTheme.addEventListener("change", () => {
          if (document.documentElement.dataset.themeChoice === "auto") {
            applyTheme("auto");
          }
        });
      })();
    </script>
    <style>
      :root {
        color-scheme: light;
        --logo-navy: #015a85;
        --logo-blue: #055c83;
        --logo-teal: #0488a5;
        --logo-sky: #79bdd7;
        --logo-ice: #acd7ee;
        --deep-teal: var(--logo-navy);
        --teal: var(--logo-teal);
        --accent: var(--logo-navy);
        --pacific-blue: var(--logo-sky);
        --ink: #082b3d;
        --muted: #476778;
        --background: #f2f5f7;
        --surface: #ffffff;
        --surface-soft: #e6f2f8;
        --border: #b9d5e4;
        --button-background: var(--logo-blue);
        --button-background-hover: #014667;
        --button-text: #ffffff;
        --hero-wash: linear-gradient(125deg, rgb(172 215 238 / 0.78), rgb(121 189 215 / 0.35) 52%, rgb(1 90 133 / 0.08));
        --section-wash: linear-gradient(135deg, rgb(172 215 238 / 0.48), rgb(242 245 247 / 0.8));
        --panel-gradient: linear-gradient(135deg, color-mix(in srgb, var(--logo-teal) 35%, var(--logo-navy)), var(--logo-navy) 52%, #014463);
        --hero-glow: rgb(172 215 238 / 0.66);
        --accent-glow: rgb(121 189 215 / 0.2);
        --shadow: 0 24px 70px rgb(1 90 133 / 0.14);
      }

      :root[data-theme="dark"] {
        color-scheme: dark;
        --accent: var(--logo-ice);
        --ink: #f5f9fb;
        --muted: #b6d0dc;
        --background: #061d2b;
        --surface: #0c354b;
        --surface-soft: #10485f;
        --border: #3d7e9b;
        --hero-wash: linear-gradient(125deg, rgb(1 90 133 / 0.64), rgb(4 136 165 / 0.23) 55%, rgb(6 29 43 / 0.08));
        --section-wash: linear-gradient(135deg, rgb(1 90 133 / 0.36), rgb(6 29 43 / 0.3));
        --hero-glow: rgb(4 136 165 / 0.24);
        --accent-glow: rgb(121 189 215 / 0.12);
        --shadow: 0 28px 80px rgb(0 0 0 / 0.34);
      }

      @media (prefers-color-scheme: dark) {
        :root:not([data-theme]) {
          color-scheme: dark;
          --accent: var(--logo-ice);
          --ink: #f5f9fb;
          --muted: #b6d0dc;
          --background: #061d2b;
          --surface: #0c354b;
          --surface-soft: #10485f;
          --border: #3d7e9b;
          --hero-wash: linear-gradient(125deg, rgb(1 90 133 / 0.64), rgb(4 136 165 / 0.23) 55%, rgb(6 29 43 / 0.08));
          --section-wash: linear-gradient(135deg, rgb(1 90 133 / 0.36), rgb(6 29 43 / 0.3));
          --hero-glow: rgb(4 136 165 / 0.24);
          --accent-glow: rgb(121 189 215 / 0.12);
          --shadow: 0 28px 80px rgb(0 0 0 / 0.34);
        }
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        background:
          radial-gradient(circle at 12% 0%, var(--hero-glow), transparent 34rem),
          radial-gradient(circle at 92% 18%, var(--accent-glow), transparent 30rem),
          var(--background);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.55;
      }

      a {
        color: inherit;
      }

      .skip-link {
        background: var(--surface);
        border-radius: 0.5rem;
        left: 1rem;
        padding: 0.7rem 1rem;
        position: fixed;
        top: -5rem;
        z-index: 20;
      }

      .skip-link:focus {
        top: 1rem;
      }

      .shell {
        margin: 0 auto;
        max-width: 1180px;
        padding-inline: clamp(1.1rem, 4vw, 2rem);
      }

      .site-header {
        backdrop-filter: blur(18px);
        background: color-mix(in srgb, var(--background), transparent 15%);
        border-bottom: 1px solid color-mix(in srgb, var(--border), transparent 25%);
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .site-header::before {
        background: linear-gradient(90deg, var(--logo-teal), var(--logo-sky), var(--logo-navy));
        content: "";
        height: 3px;
        inset: 0 0 auto;
        position: absolute;
      }

      .header-inner {
        align-items: center;
        display: flex;
        justify-content: space-between;
        min-height: 4.7rem;
      }

      .brand {
        align-items: center;
        display: inline-flex;
        font-size: 1.25rem;
        font-weight: 850;
        gap: 0.65rem;
        letter-spacing: -0.025em;
        text-decoration: none;
      }

      .brand img {
        border-radius: 0.7rem;
        height: 2.45rem;
        width: 2.45rem;
      }

      .nav {
        align-items: center;
        display: flex;
        gap: 1.1rem;
      }

      .nav-link {
        color: var(--muted);
        font-size: 0.92rem;
        font-weight: 700;
        text-decoration: none;
      }

      .nav-link:hover {
        color: var(--ink);
      }

      .theme-switcher {
        align-items: center;
        appearance: none;
        background: var(--surface-soft);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        color: var(--muted);
        cursor: pointer;
        display: inline-flex;
        height: 2.75rem;
        justify-content: center;
        padding: 0;
        width: 2.75rem;
      }

      .theme-switcher:hover {
        background: var(--surface);
        box-shadow: 0 2px 8px rgb(1 90 133 / 0.14);
        color: var(--accent);
      }

      .theme-switcher svg {
        height: 1rem;
        width: 1rem;
      }

      .button {
        align-items: center;
        background: var(--button-background);
        border: 1px solid transparent;
        border-radius: 0.7rem;
        box-shadow: 0 8px 24px rgb(1 90 133 / 0.2);
        color: var(--button-text);
        display: inline-flex;
        font-size: 0.93rem;
        font-weight: 800;
        gap: 0.48rem;
        justify-content: center;
        min-height: 2.75rem;
        padding: 0.7rem 1rem;
        text-decoration: none;
        transition: background 160ms ease, transform 160ms ease;
      }

      .button:hover {
        background: var(--button-background-hover);
        transform: translateY(-1px);
      }

      .button.secondary {
        background: var(--surface);
        border-color: var(--border);
        box-shadow: none;
        color: var(--ink);
      }

      .button.secondary:hover {
        background: var(--surface-soft);
      }

      .button .lucide-icon {
        flex: none;
        height: 1rem;
        width: 1rem;
      }

      a:focus-visible,
      button:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--pacific-blue), white 25%);
        outline-offset: 3px;
      }

      .hero {
        background: var(--hero-wash);
        border-bottom: 1px solid color-mix(in srgb, var(--logo-teal), var(--border) 58%);
        padding-block: clamp(4rem, 9vw, 7.5rem) clamp(4rem, 8vw, 6.5rem);
      }

      .hero-grid {
        align-items: center;
        display: grid;
        gap: clamp(2.6rem, 7vw, 6rem);
        grid-template-columns: minmax(0, 1.04fr) minmax(320px, 0.96fr);
      }

      .eyebrow {
        color: var(--accent);
        font-size: 0.78rem;
        font-weight: 900;
        letter-spacing: 0.13em;
        margin: 0 0 1rem;
        text-transform: uppercase;
      }

      h1,
      h2,
      h3,
      p {
        margin-top: 0;
      }

      h1 {
        font-size: clamp(2.8rem, 7vw, 5.7rem);
        letter-spacing: -0.065em;
        line-height: 0.95;
        margin-bottom: 1.35rem;
        max-width: 11ch;
      }

      .hero-copy {
        color: var(--muted);
        font-size: clamp(1.05rem, 2vw, 1.22rem);
        max-width: 38rem;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.7rem;
      }

      .trust-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
        margin-top: 1.6rem;
      }

      .trust-pill {
        background: color-mix(in srgb, var(--surface), transparent 16%);
        border: 1px solid var(--border);
        border-radius: 999px;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 750;
        padding: 0.38rem 0.68rem;
      }

      .link-demo {
        background: linear-gradient(145deg, var(--surface), color-mix(in srgb, var(--logo-blue), var(--surface) 88%));
        border: 1px solid color-mix(in srgb, var(--logo-teal), var(--border) 46%);
        border-radius: 1.35rem;
        box-shadow: var(--shadow);
        padding: clamp(1.15rem, 3vw, 1.7rem);
        position: relative;
      }

      .link-demo::before {
        background: linear-gradient(135deg, var(--logo-teal), var(--logo-ice));
        border-radius: 1.35rem;
        content: "";
        inset: 0.7rem -0.7rem -0.7rem 0.7rem;
        opacity: 0.3;
        position: absolute;
        z-index: -1;
      }

      .demo-toolbar {
        align-items: center;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        margin-bottom: 1.2rem;
        padding-bottom: 1rem;
      }

      .demo-brand {
        align-items: center;
        display: inline-flex;
        font-weight: 850;
        gap: 0.55rem;
      }

      .demo-brand img {
        border-radius: 0.55rem;
        height: 2rem;
        width: 2rem;
      }

      .status-dot {
        background: var(--logo-teal);
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgb(4 136 165 / 0.14);
        height: 0.55rem;
        width: 0.55rem;
      }

      .demo-label {
        color: var(--muted);
        display: block;
        font-size: 0.73rem;
        font-weight: 850;
        letter-spacing: 0.08em;
        margin-bottom: 0.38rem;
        text-transform: uppercase;
      }

      .url-box {
        background: var(--surface-soft);
        border: 1px solid var(--border);
        border-radius: 0.8rem;
        color: var(--muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.84rem;
        overflow-wrap: anywhere;
        padding: 0.8rem 0.9rem;
      }

      .route-arrow {
        align-items: center;
        color: var(--accent);
        display: flex;
        font-size: 1.35rem;
        font-weight: 900;
        gap: 0.65rem;
        margin-block: 0.85rem;
      }

      .route-arrow .lucide-icon {
        flex: none;
        height: 1.35rem;
        width: 1.35rem;
      }

      .route-arrow::before,
      .route-arrow::after {
        background: var(--border);
        content: "";
        height: 1px;
        width: 100%;
      }

      .url-box.short {
        background: color-mix(in srgb, var(--teal), var(--surface) 88%);
        border-color: color-mix(in srgb, var(--teal), var(--border) 38%);
        color: var(--deep-teal);
        font-size: 1rem;
        font-weight: 850;
      }

      :root[data-theme="dark"] .url-box.short {
        color: var(--ink);
      }

      @media (prefers-color-scheme: dark) {
        :root:not([data-theme]) .url-box.short {
          color: var(--ink);
        }
      }

      .demo-meta {
        display: grid;
        gap: 0.65rem;
        grid-template-columns: repeat(3, 1fr);
        margin-top: 1rem;
      }

      .demo-meta span {
        background: var(--background);
        border-radius: 0.6rem;
        color: var(--muted);
        font-size: 0.7rem;
        font-weight: 750;
        padding: 0.5rem;
        text-align: center;
      }

      .section {
        padding-block: clamp(3.8rem, 8vw, 6.5rem);
      }

      .section-tint {
        background: var(--section-wash);
        border-block: 1px solid color-mix(in srgb, var(--border), transparent 20%);
      }

      .section-heading {
        margin-bottom: 2.2rem;
        max-width: 44rem;
      }

      .section-heading h2 {
        font-size: clamp(2rem, 4.5vw, 3.55rem);
        letter-spacing: -0.05em;
        line-height: 1.02;
        margin-bottom: 0.8rem;
      }

      .section-heading p {
        color: var(--muted);
        font-size: 1.05rem;
      }

      .feature-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .feature-card {
        background: linear-gradient(150deg, var(--surface), color-mix(in srgb, var(--logo-blue), var(--surface) 94%));
        border: 1px solid color-mix(in srgb, var(--logo-teal), var(--border) 62%);
        border-radius: 1rem;
        min-height: 15rem;
        padding: 1.35rem;
      }

      .feature-icon {
        align-items: center;
        background: color-mix(in srgb, var(--teal), var(--surface) 86%);
        border: 1px solid color-mix(in srgb, var(--teal), var(--border) 40%);
        border-radius: 0.75rem;
        color: var(--accent);
        display: inline-flex;
        font-size: 0.82rem;
        font-weight: 950;
        height: 2.55rem;
        justify-content: center;
        margin-bottom: 1.1rem;
        width: 2.55rem;
      }

      .feature-icon .lucide-icon {
        height: 1.28rem;
        width: 1.28rem;
      }

      .feature-card h3 {
        font-size: 1.12rem;
        letter-spacing: -0.02em;
        margin-bottom: 0.55rem;
      }

      .feature-card p {
        color: var(--muted);
        font-size: 0.92rem;
        margin-bottom: 0;
      }

      .preview-section {
        border-bottom: 1px solid var(--border);
      }

      .preview-grid {
        align-items: start;
        display: grid;
        gap: 1.5rem;
        grid-template-columns: minmax(0, 1fr) minmax(170px, 230px);
      }

      .preview-frame {
        margin: 0;
        min-width: 0;
      }

      .preview-visual {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 1rem;
        box-shadow: var(--shadow);
        overflow: hidden;
        padding: 0.45rem;
      }

      .preview-visual img {
        border-radius: 0.55rem;
        display: block;
        height: auto;
        width: 100%;
      }

      .preview-visual .preview-dark,
      :root[data-theme="dark"] .preview-visual .preview-light {
        display: none;
      }

      :root[data-theme="dark"] .preview-visual .preview-dark {
        display: block;
      }

      @media (prefers-color-scheme: dark) {
        :root:not([data-theme]) .preview-visual .preview-light {
          display: none;
        }

        :root:not([data-theme]) .preview-visual .preview-dark {
          display: block;
        }
      }

      .preview-frame figcaption {
        color: var(--muted);
        font-size: 0.86rem;
        margin-top: 0.75rem;
      }

      .preview-mobile {
        max-width: 230px;
      }

      .steps {
        counter-reset: step;
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(3, 1fr);
      }

      .step {
        border-top: 2px solid var(--border);
        padding: 1.4rem 1rem 0 0;
      }

      .step::before {
        color: var(--accent);
        content: "0" counter(step);
        counter-increment: step;
        display: block;
        font-size: 0.78rem;
        font-weight: 950;
        letter-spacing: 0.09em;
        margin-bottom: 0.9rem;
      }

      .step h3 {
        font-size: 1.12rem;
        margin-bottom: 0.45rem;
      }

      .step p {
        color: var(--muted);
        font-size: 0.92rem;
      }

      .faq-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .faq-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 1rem;
        padding: 1.35rem;
      }

      .faq-card h3 {
        font-size: 1.12rem;
        margin-bottom: 0.55rem;
      }

      .faq-card p {
        color: var(--muted);
        font-size: 0.92rem;
        margin-bottom: 0;
      }

      .control-panel {
        align-items: center;
        background: var(--panel-gradient);
        border-radius: 1.3rem;
        color: #ffffff;
        display: grid;
        gap: 2rem;
        grid-template-columns: 1fr auto;
        padding: clamp(1.6rem, 5vw, 3.2rem);
      }

      .control-panel h2 {
        font-size: clamp(1.8rem, 4vw, 3rem);
        letter-spacing: -0.045em;
        line-height: 1.05;
        margin-bottom: 0.7rem;
      }

      .control-panel p {
        color: #d9edf5;
        margin-bottom: 0;
        max-width: 42rem;
      }

      .control-panel-actions {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .control-panel .button {
        background: #ffffff;
        color: var(--deep-teal);
        white-space: nowrap;
      }

      .control-panel .button:hover {
        background: var(--logo-ice);
      }

      .control-panel .button.guide {
        background: transparent;
        border-color: var(--logo-ice);
        color: #ffffff;
      }

      .control-panel .button.guide:hover {
        background: rgb(255 255 255 / 0.12);
      }

      footer {
        color: var(--muted);
        font-size: 0.82rem;
        padding-block: 2.4rem max(2.4rem, env(safe-area-inset-bottom));
      }

      .footer-inner {
        align-items: center;
        display: flex;
        gap: 1rem;
        justify-content: space-between;
      }

      .footer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem 1.2rem;
      }

      .footer-links a {
        color: var(--accent);
        font-weight: 750;
        text-decoration: none;
      }

      .footer-links a:hover {
        text-decoration: underline;
      }

      @media (max-width: 900px) {
        .hero-grid {
          grid-template-columns: 1fr;
        }

        .hero-copy {
          max-width: 44rem;
        }

        .link-demo {
          margin-inline: auto;
          max-width: 38rem;
          width: 100%;
        }

        .feature-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .faq-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .header-inner {
          min-height: 4.2rem;
        }

        .nav-link {
          display: none;
        }

        .nav {
          gap: 0.55rem;
        }

        .nav > .button {
          min-height: 2.45rem;
          padding-inline: 0.75rem;
        }

        .hero {
          padding-top: 3.5rem;
        }

        h1 {
          font-size: clamp(2.65rem, 15vw, 4rem);
        }

        .hero-actions .button {
          width: 100%;
        }

        .feature-grid,
        .steps,
        .preview-grid {
          grid-template-columns: 1fr;
        }

        .preview-mobile {
          margin-inline: auto;
        }

        .feature-card {
          min-height: 0;
        }

        .control-panel {
          grid-template-columns: 1fr;
        }

        .control-panel .button {
          width: 100%;
        }

        .footer-inner {
          align-items: flex-start;
          flex-direction: column;
          gap: 0.4rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        html {
          scroll-behavior: auto;
        }

        .button {
          transition: none;
        }
      }
    </style>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="shell header-inner">
        <a class="brand" href="/" aria-label="Surls home">
          <img src="/brand/surls-app-icon-80.png" width="40" height="40" alt="" />
          <span>Surls</span>
        </a>
        <nav class="nav" aria-label="Primary navigation">
          <a class="nav-link" href="#features">Features</a>
          <a class="nav-link" href="#preview">Preview</a>
          <a class="nav-link" href="#workflow">How it works</a>
          <button class="theme-switcher" type="button" data-theme-cycle aria-label="Color theme: System. Switch to Dark." title="Color theme: System. Switch to Dark.">
            <span data-theme-icon="light" hidden>${ICONS.sun}</span>
            <span data-theme-icon="auto">${ICONS.monitor}</span>
            <span data-theme-icon="dark" hidden>${ICONS.moon}</span>
          </button>
          <a class="button" href="/admin">${ICONS.login}<span>Admin login</span></a>
        </nav>
      </div>
    </header>

    <main id="main">
      <section class="hero">
        <div class="shell hero-grid">
          <div>
            <p class="eyebrow">Private link management, on your terms</p>
            <h1>Short links that stay under your control.</h1>
            <p class="hero-copy">
              Surls helps you create memorable aliases, manage redirects, share files, and understand clicks—without
              handing your link history to someone else.
            </p>
            <div class="hero-actions">
              <a class="button" href="/admin">${ICONS.login}<span>Open the admin</span></a>
              <a class="button secondary" href="#features">${ICONS.arrowDown}<span>Explore features</span></a>
            </div>
            <div class="trust-row" aria-label="Product highlights">
              <span class="trust-pill">Self-hosted</span>
              <span class="trust-pill">Passkeys &amp; 2FA</span>
              <span class="trust-pill">Privacy-aware analytics</span>
            </div>
          </div>

          <div class="link-demo" aria-label="Example of a long destination becoming a short URL">
            <div class="demo-toolbar">
              <span class="demo-brand">
                <img src="/brand/surls-app-icon-80.png" width="32" height="32" alt="" />
                Surls
              </span>
              <span class="status-dot" title="Available"></span>
            </div>
            <span class="demo-label">Destination</span>
            <div class="url-box">docs.example.com/launch/operations-guide</div>
            <div class="route-arrow" aria-hidden="true">${ICONS.arrowDown}</div>
            <span class="demo-label">Short URL</span>
            <div class="url-box short">your.domain/launch</div>
            <div class="demo-meta">
              <span>Custom alias</span>
              <span>QR ready</span>
              <span>Trackable</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section section-tint" id="features">
        <div class="shell">
          <div class="section-heading">
            <p class="eyebrow">Everything in one place</p>
            <h2>More than a URL shortener.</h2>
            <p>Create, organize, protect, and measure the links you use every day from one focused dashboard.</p>
          </div>
          <div class="feature-grid">
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${ICONS.link}</span>
              <h3>Memorable short links</h3>
              <p>Generate a code or choose a custom alias, then edit the destination later without changing the link.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${ICONS.externalLink}</span>
              <h3>Redirect controls</h3>
              <p>Enable, disable, archive, expire, or click-limit links while destination checks help catch mistakes.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${ICONS.analytics}</span>
              <h3>Privacy-aware analytics</h3>
              <p>Understand visits, referrers, browsers, devices, and trends with retention and privacy controls built in.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${ICONS.upload}</span>
              <h3>Upload &amp; shorten</h3>
              <p>Upload a file, create its managed short link, and keep it organized with the rest of your links and tags.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${ICONS.qrCode}</span>
              <h3>QR codes and sharing</h3>
              <p>Copy, share, or download a QR code for any link, with CSV export when you need the underlying data.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${ICONS.key}</span>
              <h3>Secure administration</h3>
              <p>Protect the dashboard with passkeys, TOTP two-factor authentication, backup codes, and login rate limits.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section preview-section" id="preview">
        <div class="shell">
          <div class="section-heading">
            <p class="eyebrow">A look inside</p>
            <h2>See Surls at work.</h2>
            <p>Manage aliases, review clicks, and spot links that need attention. These previews use fictional data.</p>
          </div>
          <div class="preview-grid">
            <figure class="preview-frame">
              <div class="preview-visual">
                <img class="preview-light" src="/brand/surls-dashboard-light.jpg" width="1280" height="720"
                  alt="Surls dashboard in light mode with example links and click statistics" loading="lazy" decoding="async" />
                <img class="preview-dark" src="/brand/surls-dashboard-dark.jpg" width="1280" height="720"
                  alt="Surls dashboard in dark mode with example links and click statistics" loading="lazy" decoding="async" />
              </div>
              <figcaption>Dashboard preview. A new installation starts with an empty dashboard.</figcaption>
            </figure>
            <figure class="preview-frame preview-mobile">
              <div class="preview-visual">
                <img src="/brand/surls-dashboard-mobile.jpg" width="390" height="844"
                  alt="Surls dashboard on a mobile screen with example links and click statistics" loading="lazy" decoding="async" />
              </div>
              <figcaption>Mobile dashboard in light mode.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section class="section" id="workflow">
        <div class="shell">
          <div class="section-heading">
            <p class="eyebrow">Simple by design</p>
            <h2>From destination to dependable short link.</h2>
          </div>
          <div class="steps">
            <article class="step">
              <h3>Add a destination</h3>
              <p>Paste a URL or upload a file, then choose a generated code or a memorable custom alias.</p>
            </article>
            <article class="step">
              <h3>Set the rules</h3>
              <p>Add tags and notes, configure expiration or click limits, and review the destination before sharing.</p>
            </article>
            <article class="step">
              <h3>Share and learn</h3>
              <p>Copy the short URL or QR code, then use privacy-aware statistics to understand how it performs.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section section-tint" id="faq">
        <div class="shell">
          <div class="section-heading">
            <p class="eyebrow">Good to know</p>
            <h2>Common questions.</h2>
          </div>
          <div class="faq-grid">
            <article class="faq-card">
              <h3>Where does Surls run?</h3>
              <p>On your own server with PostgreSQL. The setup guide walks through a Docker Compose installation.</p>
            </article>
            <article class="faq-card">
              <h3>Can I replace this homepage?</h3>
              <p>Yes. Add an index.html to your public webroot to serve your own site on the same domain.</p>
            </article>
            <article class="faq-card">
              <h3>Can I control links and analytics?</h3>
              <p>Set expiration or click limits on links, and choose privacy and retention settings for click data.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="shell">
          <div class="control-panel">
            <div>
              <p class="eyebrow">Your domain. Your data.</p>
              <h2>A link service that belongs to you.</h2>
              <p>
                Surls is built for personal, self-hosted link management. Keep the service private, use your own domain,
                and replace this page with an owner-provided public site whenever you want.
              </p>
            </div>
            <div class="control-panel-actions">
              <a class="button" href="/admin">${ICONS.login}<span>Admin login</span></a>
              <a class="button guide" href="https://github.com/asetho/Surls/blob/main/docs/deployment.md">Read setup guide</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <div class="shell footer-inner">
        <span><strong>Surls</strong> — private short links, simplified.</span>
        <nav class="footer-links" aria-label="Footer">
          <a href="#faq">FAQ</a>
          <a href="https://github.com/asetho/Surls/blob/main/docs/deployment.md">Setup guide</a>
          <a href="https://github.com/asetho/Surls">Source code</a>
        </nav>
      </div>
    </footer>
  </body>
</html>`;

const DEFAULT_HOMEPAGE_CONTENT_LENGTH = new TextEncoder().encode(DEFAULT_HOMEPAGE_HTML).byteLength;

export function defaultHomepageResponse(method: "GET" | "HEAD" = "GET") {
  return new Response(method === "HEAD" ? null : DEFAULT_HOMEPAGE_HTML, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(DEFAULT_HOMEPAGE_CONTENT_LENGTH),
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    },
    status: 200
  });
}
