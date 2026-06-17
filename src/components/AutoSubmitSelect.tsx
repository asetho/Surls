"use client";

import type { ChangeEvent, SelectHTMLAttributes } from "react";

export function AutoSubmitSelect({ onChange, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange?.(event);
    if (!event.defaultPrevented) event.currentTarget.form?.requestSubmit();
  };

  return <select {...props} onChange={handleChange} />;
}
