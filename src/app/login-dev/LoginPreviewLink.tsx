"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export function LoginPreviewLink({
  children,
  current,
  href
}: {
  children: ReactNode;
  current?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={current ? "page" : undefined}
      onNavigate={(event) => {
        event.preventDefault();
        window.location.assign(href);
      }}
    >
      {children}
    </Link>
  );
}
