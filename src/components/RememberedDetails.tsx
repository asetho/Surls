"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type RememberedDetailsProps = {
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  storageKey: string;
  summaryClassName?: string;
  status?: ReactNode;
  title: string;
};

function storedOpen(storageKey: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey) === "open";
}

export function RememberedDetails({
  bodyClassName,
  children,
  className,
  defaultOpen = false,
  storageKey,
  summaryClassName,
  status,
  title
}: RememberedDetailsProps) {
  const [open, setOpen] = useState(() => defaultOpen || storedOpen(storageKey));

  function handleToggle(event: React.ToggleEvent<HTMLDetailsElement>) {
    const nextOpen = event.currentTarget.open;
    setOpen(nextOpen);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, nextOpen ? "open" : "closed");
    }
  }

  return (
    <details className={className} open={open} onToggle={handleToggle}>
      <summary className={summaryClassName}>
        <h2>{title}</h2>
        {status ? <span className="settings-collapse-summary-status">{status}</span> : null}
      </summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  );
}
