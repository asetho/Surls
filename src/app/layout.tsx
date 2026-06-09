import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
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
  const themeChoice = await savedThemeChoice();
  const initialTheme = themeChoice === "dark" ? "dark" : "light";

  return (
    <html lang="en" data-theme={initialTheme} data-theme-choice={themeChoice} suppressHydrationWarning>
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

export async function PublicHeader() {
  const themeChoice = await savedThemeChoice();

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
          <ThemeToggle initialChoice={themeChoice} />
          <Link className="button" href="/login">
            Admin login
          </Link>
        </nav>
      </div>
    </header>
  );
}
