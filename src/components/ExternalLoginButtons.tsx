import { configuredExternalProviders, externalProviderConfig } from "@/lib/external-auth";

export function ExternalLoginButtons({ nextPath, required = false }: { nextPath: string; required?: boolean }) {
  const providers = configuredExternalProviders();
  if (providers.length === 0) return required ? <p className="alert">No external sign-in provider is configured. Contact the site administrator.</p> : null;
  return (
    <div className="form-stack" aria-label="External sign-in options">
      {providers.map((provider) => (
        <a className="button secondary" data-surls-auth-secondary key={provider} href={`/api/auth/external/${provider}?next=${encodeURIComponent(nextPath)}`}>
          Continue with {externalProviderConfig(provider)!.label}
        </a>
      ))}
    </div>
  );
}
