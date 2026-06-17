"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Minus, Palette, X } from "lucide-react";
import { DashboardThemeEditor } from "@/components/DashboardThemeEditor";
import {
  dashboardThemeCssVariables,
  dashboardThemeToFormData,
  isDefaultDashboardTheme,
  type DashboardTheme,
  type DashboardThemeMode
} from "@/lib/dashboard-theme";

const THEME_EDITOR_STORAGE_KEY = "surls-theme-editor-open";
const THEME_EDITOR_MINIMIZED_STORAGE_KEY = "surls-theme-editor-minimized";
const ADMIN_TOAST_EVENT = "surls-admin-toast";

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

function currentDocumentThemeMode(): DashboardThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function showAdminToast(type: "error" | "success", message: string) {
  window.dispatchEvent(new CustomEvent(ADMIN_TOAST_EVENT, { detail: { message, type } }));
}

function isThemeResponse(value: unknown): value is { dashboardTheme: DashboardTheme; message?: string } {
  return Boolean(value && typeof value === "object" && "dashboardTheme" in value);
}

export function DashboardThemeDrawer({ csrf, theme }: { csrf: string; theme: DashboardTheme }) {
  const [savedTheme, setSavedTheme] = useState(theme);
  const [draftTheme, setDraftTheme] = useState(theme);
  const [activeMode, setActiveMode] = useState<DashboardThemeMode>(() => currentDocumentThemeMode());
  const [submitting, setSubmitting] = useState<"reset" | "save" | null>(null);
  const savedThemeRef = useRef(savedTheme);
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const requestedOpen = new URLSearchParams(window.location.search).get("themeEditor") === "open";
    const storedOpen = window.sessionStorage.getItem(THEME_EDITOR_STORAGE_KEY) === "1";
    return requestedOpen || storedOpen;
  });
  const [minimized, setMinimized] = useState(() => {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).get("themeEditor") === "open") return false;
    return window.sessionStorage.getItem(THEME_EDITOR_MINIMIZED_STORAGE_KEY) === "1";
  });
  const pathname = usePathname();
  const router = useRouter();
  const readonlySearchParams = useSearchParams();
  const searchParams = useMemo(() => new URLSearchParams(readonlySearchParams.toString()), [readonlySearchParams]);
  const requestedOpen = readonlySearchParams.get("themeEditor") === "open";
  const isDefault = isDefaultDashboardTheme(savedTheme);

  useEffect(() => {
    savedThemeRef.current = savedTheme;
  }, [savedTheme]);

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
    return () => {
      applyThemeVariables(savedThemeRef.current);
    };
  }, []);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    window.sessionStorage.setItem(THEME_EDITOR_STORAGE_KEY, "0");
    applyThemeVariables(savedTheme);
    router.replace(adminPathWithoutEditor(pathname, searchParams), { scroll: false });
  }, [pathname, router, savedTheme, searchParams]);

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
      showAdminToast("success", body.message ?? "Dashboard theme saved.");
    } catch (error) {
      showAdminToast("error", error instanceof Error ? error.message : "Could not save dashboard theme.");
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
          draftTheme={draftTheme}
          initialMode={activeMode}
          theme={savedTheme}
          variant="drawer"
          showModePreviews={false}
          onTestToast={(type) =>
            showAdminToast(
              type,
              type === "success" ? "Theme success toast preview." : "Theme error toast preview."
            )
          }
          onDraftThemeChange={setDraftTheme}
        />
      </form>

      <div className="theme-editor-drawer-actions">
        <button type="submit" form="dashboard-theme-drawer-form" disabled={submitting !== null}>
          {submitting === "save" ? "Saving..." : "Save Theme"}
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
