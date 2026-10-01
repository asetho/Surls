export type SidebarBranding = {
  logo: "placeholder" | "custom" | "none";
  text: string;
  logoHeight: number;
  paddingX: number;
  paddingY: number;
  lightImage: string;
  darkImage: string;
};

export const DEFAULT_SIDEBAR_BRANDING: SidebarBranding = {
  logo: "placeholder", text: "", logoHeight: 36, paddingX: 2, paddingY: 4, lightImage: "", darkImage: ""
};
export const SIDEBAR_LOGO_MAX_BYTES = 512 * 1024;
export const SIDEBAR_LOGO_MAX_ENCODED_LENGTH = Math.ceil(SIDEBAR_LOGO_MAX_BYTES / 3) * 4 + 128;

export function normalizeSidebarBranding(value: unknown): SidebarBranding {
  if (!value || typeof value !== "object") return { ...DEFAULT_SIDEBAR_BRANDING };
  const input = value as Record<string, unknown>;
  const image = (value: unknown) => typeof value === "string" && value.length <= SIDEBAR_LOGO_MAX_ENCODED_LENGTH &&
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : "";
  return {
    logo: input.logo === "custom" || input.logo === "none" ? input.logo : "placeholder",
    paddingX: typeof input.paddingX === "number" && Number.isFinite(input.paddingX) ? Math.max(0, Math.min(24, Math.round(input.paddingX))) : 2,
    paddingY: typeof input.paddingY === "number" && Number.isFinite(input.paddingY) ? Math.max(0, Math.min(24, Math.round(input.paddingY))) : 4,
    logoHeight: typeof input.logoHeight === "number" && Number.isFinite(input.logoHeight) ? Math.max(20, Math.min(64, Math.round(input.logoHeight))) : 36,
    text: typeof input.text === "string" ? input.text.trim().slice(0, 60) : "",
    lightImage: image(input.lightImage),
    darkImage: image(input.darkImage)
  };
}

export function sidebarBrandingMatches(a: SidebarBranding, b: SidebarBranding) {
  return a.logo === b.logo && a.logoHeight === b.logoHeight && a.paddingX === b.paddingX && a.paddingY === b.paddingY && a.text === b.text && a.lightImage === b.lightImage && a.darkImage === b.darkImage;
}
