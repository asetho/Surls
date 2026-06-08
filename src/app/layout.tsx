import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { ThemeScript } from "@/components/ThemeScript";
import { ThemeToggle } from "@/components/ThemeToggle";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: {
    default: "Surls",
    template: "%s | Surls"
  },
  description: "Surls is a personal short URL system for managing private links, redirects, and click statistics.",
  applicationName: "Surls"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" data-theme-choice="auto" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}

export function PublicHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">S</span>
          <span>{env.APP_NAME}</span>
        </Link>
        <nav className="nav-actions" aria-label="Primary">
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <ThemeToggle />
          <Link className="button" href="/login">
            Admin login
          </Link>
        </nav>
      </div>
    </header>
  );
}
