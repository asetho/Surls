import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import "../../public/fonts/fonts.css";
import "../../public/brand/brand.css";
import "./admin-data.css";
import "./admin-theme-editor.css";
import { CurrentPageManifest } from "@/components/CurrentPageManifest";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SurlsLogo } from "@/components/SurlsLogo";
import { DEFAULT_DASHBOARD_THEME, dashboardThemeCssVariables } from "@/lib/dashboard-theme";
import { getSettings, getSiteName } from "@/lib/settings";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: DEFAULT_DASHBOARD_THEME.light.background },
    { media: "(prefers-color-scheme: dark)", color: DEFAULT_DASHBOARD_THEME.dark.background }
  ]
};

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`
    },
    description: `${siteName} is a personal short URL system for managing private links, redirects, and click statistics.`,
    applicationName: siteName,
    icons: {
      icon: [
        { url: "/favicon.ico?v=20260930", sizes: "any" },
        { url: "/favicon.svg?v=20260930", type: "image/svg+xml" }
      ],
      apple: [{ url: "/apple-touch-icon.png" }]
    }
  };
}

type ThemeChoice = "light" | "dark" | "auto";

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "auto";
}

async function savedThemeChoice() {
  const cookieStore = await cookies();
  const cookieChoice = cookieStore.get("surls-theme")?.value;
  return isThemeChoice(cookieChoice) ? cookieChoice : "auto";
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [themeChoice, settings] = await Promise.all([savedThemeChoice(), getSettings()]);
  const initialTheme = themeChoice === "dark" ? "dark" : "light";
  const dashboardThemeStyle = dashboardThemeCssVariables(settings.dashboardTheme) as CSSProperties;

  return (
    <html lang="en" data-theme={initialTheme} data-theme-choice={themeChoice} style={dashboardThemeStyle} suppressHydrationWarning>
      <head>
        <CurrentPageManifest />
      </head>
      <body>
        {children}
        <Script id="surls-theme-script" src="/surls-theme.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

export async function PublicHeader() {
  const [themeChoice, siteName] = await Promise.all([savedThemeChoice(), getSiteName()]);
  const brandInitial = siteName.slice(0, 1).toUpperCase() || "S";

  return (
    <header className="site-header surls-brand-surface">
      <div className="container site-header-inner">
        <Link className="brand" href="/">
          {siteName === "Surls" ? <SurlsLogo /> : <><span className="brand-mark">{brandInitial}</span><span>{siteName}</span></>}
        </Link>
        <nav className="nav-actions" aria-label="Primary">
          <ThemeToggle initialChoice={themeChoice} />
          <Link className="button" href="/admin">
            Admin login
          </Link>
        </nav>
      </div>
    </header>
  );
}
