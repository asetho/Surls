"use client";

import { ArrowLeft } from "lucide-react";

export function BackButton() {
  return (
    <button type="button" className="secondary" onClick={() => window.history.back()}>
      <ArrowLeft size={16} aria-hidden />
      Go back
    </button>
  );
}
