"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { destinationWarnings } from "@/lib/destination-warnings";

export function DestinationWarnings({ value }: { value: string }) {
  const warnings = useMemo(() => destinationWarnings(value), [value]);
  if (!warnings.length) return null;

  return (
    <div className="destination-warnings alert small" role="status" aria-live="polite">
      <div className="destination-warnings-title">
        <AlertTriangle size={15} aria-hidden />
        <strong>Check this destination</strong>
      </div>
      <ul>
        {warnings.map((warning) => (
          <li key={warning.code}>{warning.message}</li>
        ))}
      </ul>
    </div>
  );
}
