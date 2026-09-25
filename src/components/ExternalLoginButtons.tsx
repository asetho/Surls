import Image from "next/image";
import { getConfiguredExternalProviders } from "@/lib/external-provider-settings";
import { PROVIDER_LOGOS } from "@/lib/provider-logos";
import { getSetting } from "@/lib/settings";

export async function ExternalLoginButtons({ nextPath, required = false, preview = false }: { nextPath: string; required?: boolean; preview?: boolean }) {
  const enabled = await getSetting("externalLoginEnabled");
  const providers = enabled ? await getConfiguredExternalProviders() : [];
  if (providers.length === 0) return required ? <p className="alert">No external sign-in provider is configured. Contact the site administrator.</p> : null;
  return (
    <div className="form-stack" aria-label="External sign-in options">
      {providers.map((config) => (
        <a className="button secondary external-login-button" data-surls-auth-secondary data-provider={config.provider} data-custom-logo={Boolean(config.logoDataUrl)} key={config.key}
          href={preview ? undefined : `/api/auth/external/${config.key}?next=${encodeURIComponent(nextPath)}`}
          role={preview ? "link" : undefined} aria-disabled={preview || undefined} data-surls-auth-preview={preview || undefined} tabIndex={preview ? 0 : undefined}>
          <Image className="external-login-logo" src={config.logoDataUrl || PROVIDER_LOGOS[config.provider]} alt="" width={20} height={20} unoptimized />
          Continue with {config.label}
        </a>
      ))}
    </div>
  );
}
