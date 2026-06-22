"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { TURNSTILE_RESPONSE_FIELD } from "@/lib/turnstile-shared";

type TurnstileWidgetOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  "response-field": false;
  theme: "auto";
};

type TurnstileApi = {
  render: (element: HTMLElement | string, options: TurnstileWidgetOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileGate({ children, siteKey }: { children: ReactNode; siteKey?: string }) {
  const rawId = useId();
  const widgetId = useMemo(() => `turnstile-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [rawId]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedWidgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const [status, setStatus] = useState<"idle" | "verified" | "expired" | "error">("idle");
  const [token, setToken] = useState("");

  const renderWidget = useCallback(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile || renderedWidgetId.current) return;

    renderedWidgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      "response-field": false,
      callback: (nextToken) => {
        setToken(nextToken);
        setStatus("verified");
      },
      "expired-callback": () => {
        setToken("");
        setStatus("expired");
        if (renderedWidgetId.current) window.turnstile?.reset(renderedWidgetId.current);
      },
      "error-callback": () => {
        setToken("");
        setStatus("error");
      }
    });
  }, [scriptReady, siteKey]);

  useEffect(() => {
    renderWidget();

    return () => {
      if (renderedWidgetId.current) {
        window.turnstile?.remove(renderedWidgetId.current);
        renderedWidgetId.current = null;
      }
    };
  }, [renderWidget]);

  if (!siteKey) return <>{children}</>;

  return (
    <div className="turnstile-protected" data-surls-turnstile-protected>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        async
        defer
        onLoad={() => setScriptReady(true)}
      />
      <div
        className="turnstile-gate"
        data-surls-auth-turnstile
        data-turnstile-status={status}
        hidden={status === "verified"}
        aria-live="polite"
      >
        <div>
          <strong>Security check</strong>
          <p className="muted small">Complete this check to load the sign-in form.</p>
        </div>
        <div id={widgetId} ref={containerRef} className="turnstile-widget" />
        {status === "expired" ? <p className="muted small">The security check expired. Please try again.</p> : null}
        {status === "error" ? <p className="muted small">The security check could not load. Please refresh and try again.</p> : null}
      </div>
      {status === "verified" && token ? (
        <>
          <input type="hidden" name={TURNSTILE_RESPONSE_FIELD} value={token} />
          {children}
        </>
      ) : null}
    </div>
  );
}
