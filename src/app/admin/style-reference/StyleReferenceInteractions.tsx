"use client";

import { useEffect } from "react";
import {
  DASHBOARD_THEME_EDITOR_FOCUS_EVENT,
  type DashboardThemeEditorFocusDetail
} from "@/lib/theme-editor-events";
import type { DashboardThemeKey, DashboardThemeMode } from "@/lib/dashboard-theme";

function currentThemeMode(): DashboardThemeMode {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function activateTarget(target: HTMLElement) {
  const field = target.dataset.themeField as DashboardThemeKey | undefined;
  if (!field) return;

  const detail: DashboardThemeEditorFocusDetail = {
    field,
    mode: (target.dataset.themeMode as DashboardThemeMode | undefined) ?? currentThemeMode()
  };
  window.dispatchEvent(new CustomEvent(DASHBOARD_THEME_EDITOR_FOCUS_EVENT, { detail }));
}

export function StyleReferenceInteractions() {
  useEffect(() => {
    function closestTarget(eventTarget: EventTarget | null) {
      if (!(eventTarget instanceof Element)) return null;
      const target = eventTarget.closest<HTMLElement>("[data-theme-field]");
      if (!target?.closest(".style-reference-page")) return null;
      return target;
    }

    function handleClick(event: MouseEvent) {
      const target = closestTarget(event.target);
      if (!target) return;

      event.preventDefault();
      activateTarget(target);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = closestTarget(event.target);
      if (!target) return;

      event.preventDefault();
      activateTarget(target);
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
