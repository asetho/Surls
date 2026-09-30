"use client";

import { useState, type ReactNode } from "react";

export function TurnstilePreviewGate({ children, onComplete }: { children: ReactNode; onComplete?: () => void }) {
  const [complete, setComplete] = useState(false);

  return (
    <div className="turnstile-protected" data-surls-turnstile-preview>
      {complete ? children : (
        <div className="turnstile-gate" data-surls-auth-turnstile data-turnstile-status="idle">
          <div>
            <strong>Security check</strong>
            <p className="muted small">Complete this check to load the sign-in form.</p>
          </div>
          <button className="turnstile-preview-challenge" data-surls-preview-check type="button" onClick={() => { setComplete(true); onComplete?.(); }}>
            <span className="turnstile-preview-checkbox" aria-hidden="true" />
            <span className="turnstile-preview-text">I’m human</span>
            <span className="turnstile-preview-label">Simulated Turnstile</span>
          </button>
          <p className="muted small">Preview only. No verification is performed.</p>
        </div>
      )}
    </div>
  );
}
