"use client";

import Image from "next/image";
import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { Link2 } from "lucide-react";
import { DEFAULT_SIDEBAR_BRANDING, type SidebarBranding } from "@/lib/sidebar-branding";

const BrandingContext = createContext({
  branding: DEFAULT_SIDEBAR_BRANDING,
  preview: (() => {}) as (value: SidebarBranding | null) => void
});

export function AdminBrandingProvider({ branding, children }: { branding: SidebarBranding; children: ReactNode }) {
  const [previewBranding, preview] = useState<SidebarBranding | null>(null);
  return <BrandingContext value={{ branding: previewBranding ?? branding, preview }}>{children}</BrandingContext>;
}

export const useAdminBranding = () => useContext(BrandingContext);

export function AdminSidebarBrand({ siteName, value }: { siteName: string; value?: SidebarBranding }) {
  const context = useAdminBranding();
  const branding = value ?? context.branding;
  const customImage = branding.logo === "custom" && (branding.lightImage || branding.darkImage);
  const placeholder = branding.logo === "placeholder" || (branding.logo === "custom" && !customImage);
  const text = branding.text || (placeholder ? siteName : "");
  return (
    <span className="admin-sidebar-logo" aria-label={text || siteName} style={{ "--sidebar-logo-height": `${branding.logoHeight}px`, "--sidebar-logo-padding-x": `${branding.paddingX}px`, "--sidebar-logo-padding-y": `${branding.paddingY}px` } as CSSProperties}>
      {placeholder ? <Link2 className="admin-sidebar-mark" aria-hidden /> : null}
      {customImage ? <span className="admin-sidebar-custom-images">
        <Image className="admin-sidebar-image-light" src={branding.lightImage || branding.darkImage} alt="" width={160} height={36} unoptimized />
        <Image className="admin-sidebar-image-dark" src={branding.darkImage || branding.lightImage} alt="" width={160} height={36} unoptimized />
      </span> : null}
      {text ? <span className="admin-sidebar-logo-text">{text}</span> : null}
    </span>
  );
}
