"use client";

import { usePathname } from "next/navigation";
import { manifestHrefForPath } from "@/lib/manifest-start";

export function CurrentPageManifest() {
  const pathname = usePathname();
  return <link rel="manifest" href={manifestHrefForPath(pathname)} />;
}
