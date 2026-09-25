import type { ExternalProvider } from "./external-provider-settings";

export function providerProfileKey(provider: ExternalProvider, clientId: string): string | null {
  const trimmedId = clientId.trim();
  if (!trimmedId) return null;
  const slug = trimmedId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (slug === trimmedId && slug.length <= 96) return `${provider}-${slug}`;

  // A digest keeps distinct IDs distinct when lowercasing, punctuation, or length changes the slug.
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < trimmedId.length; index++) {
    hash = ((hash ^ BigInt(trimmedId.charCodeAt(index))) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  const prefix = slug ? slug.slice(0, 80).replace(/-+$/g, "") : "id";
  return `${provider}-${prefix}-${hash.toString(16).padStart(16, "0")}`;
}
