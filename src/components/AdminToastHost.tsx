"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { normalizeAdminToastType, type AdminToastType } from "@/lib/admin-toast";
import { ADMIN_TOAST_EVENT, adminToastFromEvent } from "@/lib/admin-toast-event";

export function AdminToastHost() {
  const searchParams = useSearchParams();
  const toast = searchParams.get("toast");
  const type = normalizeAdminToastType(searchParams.get("toastType"));
  const [activeToast, setActiveToast] = useState<{ message: string; type: AdminToastType } | null>(null);
  const eventHideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!toast) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    url.searchParams.delete("toastType");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

    const showTimeout = window.setTimeout(() => setActiveToast({ message: toast, type }), 0);
    const hideTimeout = window.setTimeout(() => {
      setActiveToast((currentToast) =>
        currentToast?.message === toast && currentToast.type === type ? null : currentToast
      );
    }, 4800);

    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [toast, type]);

  useEffect(() => {
    function handleToastEvent(event: Event) {
      const nextToast = adminToastFromEvent(event);
      if (!nextToast) return;

      setActiveToast(nextToast);
      if (eventHideTimeoutRef.current !== null) window.clearTimeout(eventHideTimeoutRef.current);
      eventHideTimeoutRef.current = window.setTimeout(() => {
        setActiveToast((currentToast) =>
          currentToast?.message === nextToast.message && currentToast.type === nextToast.type ? null : currentToast
        );
      }, 4800);
    }

    window.addEventListener(ADMIN_TOAST_EVENT, handleToastEvent);
    return () => {
      window.removeEventListener(ADMIN_TOAST_EVENT, handleToastEvent);
      if (eventHideTimeoutRef.current !== null) window.clearTimeout(eventHideTimeoutRef.current);
    };
  }, []);

  if (!activeToast) return null;

  const Icon = activeToast.type === "error" ? AlertTriangle : CheckCircle2;

  return (
    <div className="system-toast-region" aria-live={activeToast.type === "error" ? "assertive" : "polite"} aria-atomic="true">
      <div className={`system-toast system-toast-${activeToast.type}`} role={activeToast.type === "error" ? "alert" : "status"}>
        <Icon size={18} aria-hidden />
        <span>{activeToast.message}</span>
        <button
          className="system-toast-dismiss"
          type="button"
          aria-label="Dismiss notification"
          onClick={() => setActiveToast(null)}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
