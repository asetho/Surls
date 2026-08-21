"use client";

import { useEffect, useId, useRef, useState } from "react";

type AvailabilityState =
  | { status: "idle"; message: "" }
  | { status: "checking"; message: string }
  | { status: "available"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

const IDLE_STATE: AvailabilityState = { status: "idle", message: "" };

export function AliasAvailabilityInput({ placeholder = "optional-alias" }: { placeholder?: string }) {
  const [value, setValue] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>(IDLE_STATE);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackId = useId();

  useEffect(() => {
    const input = inputRef.current;
    input?.setCustomValidity("");
    const code = value.trim();
    if (!code) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/links/availability?code=${encodeURIComponent(code)}`, {
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as
          | { available?: boolean; error?: string | null }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Could not check alias availability.");
        }
        if (payload?.available) {
          setAvailability({ status: "available", message: "Alias is available." });
          return;
        }

        const reason = payload?.error || "That alias is unavailable.";
        input?.setCustomValidity(reason);
        setAvailability({ status: "unavailable", message: `Alias is unavailable. ${reason}` });
      } catch (error) {
        if (controller.signal.aborted) return;
        setAvailability({
          status: "error",
          message: error instanceof Error ? error.message : "Could not check alias availability."
        });
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  return (
    <div className="alias-availability-field" data-status={availability.status}>
      <input
        aria-describedby={availability.status === "idle" ? undefined : feedbackId}
        aria-invalid={availability.status === "unavailable" ? true : undefined}
        name="code"
        onChange={(event) => {
          const nextValue = event.target.value;
          event.target.setCustomValidity("");
          setValue(nextValue);
          setAvailability(nextValue.trim()
            ? { status: "checking", message: "Checking alias availability…" }
            : IDLE_STATE);
        }}
        pattern="[A-Za-z0-9_-]{3,64}"
        placeholder={placeholder}
        ref={inputRef}
        spellCheck={false}
        value={value}
      />
      <span className="alias-availability-message small" id={feedbackId} aria-live="polite">
        {availability.message}
      </span>
    </div>
  );
}
