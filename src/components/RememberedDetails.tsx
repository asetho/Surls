"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type RememberedDetailsProps = {
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  storageKey: string;
  summaryClassName?: string;
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
  storageKey,
  summaryClassName,
  title
}: RememberedDetailsProps) {
  const [open, setOpen] = useState(() => storedOpen(storageKey));

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
      </summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  );
}
