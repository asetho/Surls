import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { ThemeScript } from "@/components/ThemeScript";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSiteName } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`
    },
    description: `${siteName} is a personal short URL system for managing private links, redirects, and click statistics.`,
    applicationName: siteName
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
  const [themeChoice, siteName] = await Promise.all([savedThemeChoice(), getSiteName()]);
  const initialTheme = themeChoice === "dark" ? "dark" : "light";

  return (
    <html lang="en" data-theme={initialTheme} data-theme-choice={themeChoice} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://use.typekit.net" />
        <link rel="preconnect" href="https://p.typekit.net" />
        <link rel="stylesheet" href="https://use.typekit.net/ynp6ech.css" />
        <ThemeScript />
      </head>
      <body>
        {children}
        <CookieBanner siteName={siteName} />
      </body>
    </html>
  );
}

export async function PublicHeader() {
  const [themeChoice, siteName] = await Promise.all([savedThemeChoice(), getSiteName()]);
  const brandInitial = siteName.slice(0, 1).toUpperCase() || "S";

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">{brandInitial}</span>
          <span>{siteName}</span>
        </Link>
        <nav className="nav-actions" aria-label="Primary">
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <ThemeToggle initialChoice={themeChoice} />
          <Link className="button" href="/admin">
            Admin login
          </Link>
        </nav>
      </div>
    </header>
  );
}
