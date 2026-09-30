"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

type ThemeChoice = "light" | "dark" | "auto";

const THEME_KEY = "surls-theme";
const listeners = new Set<() => void>();

function isThemeChoice(value: string | null | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "auto";
}

function cookieTheme() {
  const match = document.cookie.match(/(?:^|;\s*)surls-theme=([^;]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function localStorageTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function readThemeChoice(fallback: ThemeChoice): ThemeChoice {
  const stored = localStorageTheme();
  if (isThemeChoice(stored)) return stored;
  const cookie = cookieTheme();
  if (isThemeChoice(cookie)) return cookie;
  const dataset = document.documentElement.dataset.themeChoice;
  return isThemeChoice(dataset) ? dataset : fallback;
}

function notifyThemeListeners() {
  for (const listener of listeners) listener();
}

function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function applyTheme(choice: ThemeChoice) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = choice === "auto" ? (dark ? "dark" : "light") : choice;
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = resolved;
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // The first-party cookie below still preserves the choice for SSR.
  }
  document.cookie = `${THEME_KEY}=${encodeURIComponent(choice)}; path=/; max-age=31536000; samesite=lax`;
  notifyThemeListeners();
}

export function ThemeToggle({
  iconOnly = false,
  initialChoice = "auto"
}: {
  iconOnly?: boolean;
  initialChoice?: ThemeChoice;
}) {
  const choice = useSyncExternalStore(
    subscribeTheme,
    () => readThemeChoice(initialChoice),
    () => initialChoice
  );
  const options: Array<{ value: ThemeChoice; label: string; icon: ReactNode }> = [
    { value: "light", label: "Light", icon: <Sun size={15} aria-hidden /> },
    { value: "dark", label: "Dark", icon: <Moon size={15} aria-hidden /> },
    { value: "auto", label: "Auto", icon: <Monitor size={15} aria-hidden /> }
  ];

  return (
    <div className={iconOnly ? "theme-toggle icon-only" : "theme-toggle"} aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.value}
          className="theme-toggle-option"
          type="button"
          aria-label={`${option.label} theme`}
          aria-pressed={choice === option.value}
          title={`${option.label} theme`}
          onClick={() => {
            applyTheme(option.value);
          }}
        >
          {option.icon}
          {iconOnly ? null : <span>{option.label}</span>}
        </button>
      ))}
    </div>
  );
}
