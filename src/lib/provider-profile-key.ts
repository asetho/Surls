import type { ExternalProvider } from "./external-provider-settings";

export function providerProfileKey(provider: ExternalProvider, clientId: string): string | null {
  const trimmedId = clientId.trim();
  if (!trimmedId) return null;
  const slug = trimmedId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (slug && slug.length <= 96) return `${provider}-${slug}`;

  // Keep long and non-Latin client IDs usable without putting hundreds of characters in a callback URL.
  let hash = 2166136261;
  for (let index = 0; index < trimmedId.length; index++) {
    hash = Math.imul(hash ^ trimmedId.charCodeAt(index), 16777619);
  }
  if (!slug) return `${provider}-id-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  return `${provider}-${slug.slice(0, 80).replace(/-+$/g, "")}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
