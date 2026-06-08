"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeChoice = "light" | "dark" | "auto";

function applyTheme(choice: ThemeChoice) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = choice === "auto" ? (dark ? "dark" : "light") : choice;
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem("surls-theme", choice);
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = (localStorage.getItem("surls-theme") as ThemeChoice | null) ?? "auto";
      setChoice(stored);
      applyTheme(stored);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    applyTheme(choice);
  }, [choice]);

  const options: Array<{ value: ThemeChoice; label: string; icon: React.ReactNode }> = [
    { value: "light", label: "Light", icon: <Sun size={15} aria-hidden /> },
    { value: "dark", label: "Dark", icon: <Moon size={15} aria-hidden /> },
    { value: "auto", label: "Auto", icon: <Monitor size={15} aria-hidden /> }
  ];

  return (
    <div className="theme-toggle" aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={choice === option.value}
          title={`${option.label} theme`}
          onClick={() => {
            setChoice(option.value);
          }}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
