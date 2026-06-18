"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Minus, Palette, Upload, X } from "lucide-react";
import { DashboardThemeEditor } from "@/components/DashboardThemeEditor";
import { dispatchAdminToast } from "@/lib/admin-toast-event";
import {
  DASHBOARD_THEME_FIELDS,
  DASHBOARD_THEME_MODES,
  dashboardThemeCssVariables,
  dashboardThemeToFormData,
  isDefaultDashboardTheme,
  normalizeDashboardTheme,
  type DashboardTheme,
  type DashboardThemeKey,
  type DashboardThemeMode
} from "@/lib/dashboard-theme";
import {
  DASHBOARD_THEME_EDITOR_FOCUS_EVENT,
  type DashboardThemeEditorFocusDetail
} from "@/lib/theme-editor-events";

const THEME_EDITOR_STORAGE_KEY = "surls-theme-editor-open";
const THEME_EDITOR_MINIMIZED_STORAGE_KEY = "surls-theme-editor-minimized";
type ThemeChoice = "light" | "dark" | "auto";

function themeCssVariableMap(theme: DashboardTheme) {
  return dashboardThemeCssVariables(theme) as Record<string, string>;
}

function applyThemeVariables(theme: DashboardTheme) {
  const shell = document.querySelector<HTMLElement>(".admin-shell");
  if (!shell) return;

  for (const [name, value] of Object.entries(themeCssVariableMap(theme))) {
    shell.style.setProperty(name, value);
  }
}

function adminPathWithoutEditor(pathname: string, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete("themeEditor");
  return `${pathname}${params.size ? `?${params.toString()}` : ""}`;
}

function adminPathWithEditor(pathname: string, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  params.set("themeEditor", "open");
  return `${pathname}?${params.toString()}`;
}

function currentDocumentThemeMode(): DashboardThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function isThemeChoice(value: string | null | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "auto";
}

function storedThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem("surls-theme");
    if (isThemeChoice(stored)) return stored;
  } catch {
    // Fall back to the first-party cookie or current dataset below.
  }
  const match = document.cookie.match(/(?:^|;\s*)surls-theme=([^;]+)/);
  let cookieChoice: string | null = null;
  try {
    cookieChoice = match ? decodeURIComponent(match[1]) : null;
  } catch {
    cookieChoice = null;
  }
  if (isThemeChoice(cookieChoice)) return cookieChoice;
  const datasetChoice = document.documentElement.dataset.themeChoice;
  return isThemeChoice(datasetChoice) ? datasetChoice : "auto";
}

function preferredDocumentThemeMode(): DashboardThemeMode {
  const choice = storedThemeChoice();
  if (choice === "auto") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return choice;
}

function applyDocumentThemeMode(mode: DashboardThemeMode) {
  document.documentElement.dataset.theme = mode;
}

function isThemeResponse(value: unknown): value is { dashboardTheme: DashboardTheme; message?: string } {
  return Boolean(value && typeof value === "object" && "dashboardTheme" in value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function themeImportCandidate(value: unknown) {
  if (isRecord(value) && "dashboardTheme" in value) return value.dashboardTheme;
  return value;
}

function hasImportableThemeShape(value: unknown) {
  if (!isRecord(value)) return false;
  if (isRecord(value.light) || isRecord(value.dark)) return true;
  return DASHBOARD_THEME_FIELDS.some((field) => typeof value[field.key] === "string");
}

function dashboardThemesMatch(first: DashboardTheme, second: DashboardTheme) {
  return DASHBOARD_THEME_MODES.every((mode) =>
    DASHBOARD_THEME_FIELDS.every((field) => first[mode.key][field.key] === second[mode.key][field.key])
  );
}

function isDashboardThemeEditorFocusDetail(value: unknown): value is DashboardThemeEditorFocusDetail {
  return Boolean(
    value &&
      typeof value === "object" &&
      "field" in value &&
      typeof value.field === "string" &&
      (!("mode" in value) || value.mode === "light" || value.mode === "dark")
  );
}

export function DashboardThemeDrawer({ csrf, theme }: { csrf: string; theme: DashboardTheme }) {
  const [savedTheme, setSavedTheme] = useState(theme);
  const [draftTheme, setDraftTheme] = useState(theme);
  const [activeMode, setActiveMode] = useState<DashboardThemeMode>(() => currentDocumentThemeMode());
  const [submitting, setSubmitting] = useState<"reset" | "save" | null>(null);
  const savedThemeRef = useRef(savedTheme);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const previewModeActiveRef = useRef(false);
  const pendingFocusRef = useRef<{ field: DashboardThemeKey; mode: DashboardThemeMode } | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const readonlySearchParams = useSearchParams();
  const searchParams = useMemo(() => new URLSearchParams(readonlySearchParams.toString()), [readonlySearchParams]);
  const requestedOpen = readonlySearchParams.get("themeEditor") === "open";
  const isDefault = isDefaultDashboardTheme(savedTheme);
  const hasUnsavedChanges = !dashboardThemesMatch(draftTheme, savedTheme);

  useEffect(() => {
    savedThemeRef.current = savedTheme;
  }, [savedTheme]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      const storedOpen = window.sessionStorage.getItem(THEME_EDITOR_STORAGE_KEY) === "1";
      const storedMinimized = window.sessionStorage.getItem(THEME_EDITOR_MINIMIZED_STORAGE_KEY) === "1";
      setOpen(requestedOpen || storedOpen);
      setMinimized(requestedOpen ? false : storedMinimized);
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [requestedOpen]);

  useEffect(() => {
    if (!requestedOpen) return;
    const openTimer = window.setTimeout(() => {
      window.sessionStorage.setItem(THEME_EDITOR_STORAGE_KEY, "1");
      window.sessionStorage.setItem(THEME_EDITOR_MINIMIZED_STORAGE_KEY, "0");
      setActiveMode(currentDocumentThemeMode());
      setOpen(true);
      setMinimized(false);
    }, 0);

    return () => window.clearTimeout(openTimer);
  }, [requestedOpen]);

  useEffect(() => {
    applyThemeVariables(open ? draftTheme : savedTheme);
  }, [draftTheme, open, savedTheme]);

  useEffect(() => {
    function handleFocusRequest(event: Event) {
      if (!(event instanceof CustomEvent) || !isDashboardThemeEditorFocusDetail(event.detail)) return;
      const mode = event.detail.mode ?? currentDocumentThemeMode();
      pendingFocusRef.current = { field: event.detail.field, mode };

      window.sessionStorage.setItem(THEME_EDITOR_STORAGE_KEY, "1");
      window.sessionStorage.setItem(THEME_EDITOR_MINIMIZED_STORAGE_KEY, "0");
      setActiveMode(mode);
      setOpen(true);
      setMinimized(false);
      setFocusRequestId((requestId) => requestId + 1);
      router.replace(adminPathWithEditor(pathname, searchParams), { scroll: false });
    }

    window.addEventListener(DASHBOARD_THEME_EDITOR_FOCUS_EVENT, handleFocusRequest);
    return () => window.removeEventListener(DASHBOARD_THEME_EDITOR_FOCUS_EVENT, handleFocusRequest);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!open || minimized) return;
    const pendingFocus = pendingFocusRef.current;
    if (!pendingFocus || pendingFocus.mode !== activeMode) return;

    const focusTimer = window.setTimeout(() => {
      const panel = document.getElementById(`dashboard-theme-${pendingFocus.mode}-panel`);
      const field = panel?.querySelector<HTMLElement>(
        `[data-theme-mode-key="${pendingFocus.mode}"][data-theme-field-key="${pendingFocus.field}"]`
      );
      if (!field) return;

      const section = field.closest<HTMLDetailsElement>("details.dashboard-theme-field-section-collapsible");
      if (section) section.open = true;

      field.scrollIntoView({ behavior: "smooth", block: "center" });
      field.classList.remove("dashboard-theme-field-highlight");
      void field.offsetWidth;
      field.classList.add("dashboard-theme-field-highlight");
      pendingFocusRef.current = null;

      window.setTimeout(() => field.classList.remove("dashboard-theme-field-highlight"), 3600);
    }, 80);

    return () => window.clearTimeout(focusTimer);
  }, [activeMode, focusRequestId, minimized, open]);

  useEffect(() => {
    if (open && !minimized) {
      previewModeActiveRef.current = true;
      applyDocumentThemeMode(activeMode);
      return;
    }

    if (previewModeActiveRef.current) {
      previewModeActiveRef.current = false;
      applyDocumentThemeMode(preferredDocumentThemeMode());
    }
  }, [activeMode, minimized, open]);

  useEffect(() => {
    return () => {
      if (previewModeActiveRef.current) applyDocumentThemeMode(preferredDocumentThemeMode());
      applyThemeVariables(savedThemeRef.current);
    };
  }, []);

  const closeDrawer = useCallback(() => {
    if (
      hasUnsavedChanges &&
      !window.confirm("You have unsaved theme changes. Close the Theme Editor and discard them?")
    ) {
      return;
    }

    setOpen(false);
    setDraftTheme(savedTheme);
    window.sessionStorage.setItem(THEME_EDITOR_STORAGE_KEY, "0");
    if (previewModeActiveRef.current) {
      previewModeActiveRef.current = false;
      applyDocumentThemeMode(preferredDocumentThemeMode());
    }
    applyThemeVariables(savedTheme);
    router.replace(adminPathWithoutEditor(pathname, searchParams), { scroll: false });
  }, [hasUnsavedChanges, pathname, router, savedTheme, searchParams]);

  function minimizeDrawer() {
    setMinimized(true);
    window.sessionStorage.setItem(THEME_EDITOR_MINIMIZED_STORAGE_KEY, "1");
  }

  function expandDrawer() {
    setMinimized(false);
    window.sessionStorage.setItem(THEME_EDITOR_MINIMIZED_STORAGE_KEY, "0");
  }

  async function submitThemeForm(formData: FormData, intent: "reset" | "save") {
    formData.set("intent", intent);
    formData.set("csrf", csrf);
    setSubmitting(intent);

    try {
      const response = await fetch("/api/admin/dashboard-theme", {
        body: formData,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        method: "POST"
      });
      const body = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : "Could not save dashboard theme.";
        throw new Error(message);
      }
      if (!isThemeResponse(body)) throw new Error("Could not save dashboard theme.");

      setSavedTheme(body.dashboardTheme);
      setDraftTheme(body.dashboardTheme);
      applyThemeVariables(body.dashboardTheme);
      dispatchAdminToast("success", body.message ?? "Dashboard theme saved.");
    } catch (error) {
      dispatchAdminToast("error", error instanceof Error ? error.message : "Could not save dashboard theme.");
    } finally {
      setSubmitting(null);
    }
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitThemeForm(dashboardThemeToFormData(draftTheme), "save");
  }

  function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitThemeForm(new FormData(), "reset");
  }

  function exportTheme() {
    const contents = JSON.stringify(
      {
        schema: "surls-dashboard-theme",
        version: 1,
        exportedAt: new Date().toISOString(),
        dashboardTheme: draftTheme
      },
      null,
      2
    );
    const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `surls-dashboard-theme-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    dispatchAdminToast("success", "Theme exported.");
  }

  async function importTheme(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const candidate = themeImportCandidate(parsed);
      if (!hasImportableThemeShape(candidate)) throw new Error("Choose a Surls theme JSON file.");
      const importedTheme = normalizeDashboardTheme(candidate);
      setDraftTheme(importedTheme);
      applyThemeVariables(importedTheme);
      dispatchAdminToast("info", "Theme imported. Review and save to apply it.");
    } catch (error) {
      dispatchAdminToast("error", error instanceof Error ? error.message : "Could not import theme.");
    }
  }

  if (!open) return null;

  if (minimized) {
    return (
      <aside className="theme-editor-floating-launcher" aria-label="Theme Editor minimized">
        <button className="theme-editor-floating-button" type="button" aria-label="Expand Theme Editor" onClick={expandDrawer}>
          <Palette size={20} aria-hidden />
        </button>
      </aside>
    );
  }

  return (
    <aside className="theme-editor-drawer" aria-label="Theme Editor">
      <div className="theme-editor-drawer-header">
        <div>
          <h2>Theme Editor</h2>
          <span className={isDefault ? "status-pill" : "status-pill status-pill-active"}>
            {isDefault ? "Built-in" : "Custom"}
          </span>
        </div>
        <div className="theme-editor-drawer-header-actions">
          <button className="icon-button secondary" type="button" aria-label="Minimize Theme Editor" onClick={minimizeDrawer}>
            <Minus size={18} aria-hidden />
          </button>
          <button className="icon-button secondary" type="button" aria-label="Close Theme Editor" onClick={closeDrawer}>
            <X size={18} aria-hidden />
          </button>
        </div>
      </div>

      <form id="dashboard-theme-drawer-form" className="theme-editor-drawer-form" onSubmit={handleSave}>
        <input type="hidden" name="csrf" value={csrf} />
        <DashboardThemeEditor
          activeMode={activeMode}
          draftTheme={draftTheme}
          theme={savedTheme}
          variant="drawer"
          showModePreviews={false}
          onActiveModeChange={setActiveMode}
          onTestToast={(type) =>
            dispatchAdminToast(
              type,
              type === "success"
                ? "Theme success toast preview."
                : type === "info"
                  ? "Theme notice toast preview."
                  : "Theme error toast preview."
            )
          }
          onDraftThemeChange={setDraftTheme}
        />
      </form>

      <div className="theme-editor-drawer-actions">
        <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={importTheme} />
        <button type="submit" form="dashboard-theme-drawer-form" disabled={submitting !== null}>
          {submitting === "save" ? "Saving..." : "Save Theme"}
        </button>
        <button className="secondary" type="button" disabled={submitting !== null} onClick={() => importInputRef.current?.click()}>
          <Upload size={16} aria-hidden />
          Import
        </button>
        <button className="secondary" type="button" disabled={submitting !== null} onClick={exportTheme}>
          <Download size={16} aria-hidden />
          Export
        </button>
        {!isDefault ? (
          <form id="dashboard-theme-drawer-reset-form" onSubmit={handleReset}>
            <input type="hidden" name="csrf" value={csrf} />
            <button className="secondary" type="submit" disabled={submitting !== null}>
              {submitting === "reset" ? "Resetting..." : "Reset"}
            </button>
          </form>
        ) : null}
      </div>
    </aside>
  );
}
