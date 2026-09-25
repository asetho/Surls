import type { ExternalProvider } from "./external-provider-settings";

export function providerProfileKey(provider: ExternalProvider, clientId: string): string | null {
  const trimmedId = clientId.trim();
  const slug = trimmedId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return null;
  if (slug.length <= 96) return `${provider}-${slug}`;

  // Keep long client IDs usable without putting hundreds of characters in a callback URL.
  let hash = 2166136261;
  for (const character of trimmedId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `${provider}-${slug.slice(0, 80).replace(/-+$/g, "")}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
