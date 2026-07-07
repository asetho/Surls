export const MOBILE_MENU_SIDES = ["right", "left"] as const;

export type MobileMenuSide = (typeof MOBILE_MENU_SIDES)[number];

export const DEFAULT_MOBILE_MENU_SIDE: MobileMenuSide = "right";

export function normalizeMobileMenuSide(value: unknown): MobileMenuSide {
  const cleaned = String(value ?? "").trim().toLowerCase();
  return cleaned === "left" || cleaned === "right" ? cleaned : DEFAULT_MOBILE_MENU_SIDE;
}
