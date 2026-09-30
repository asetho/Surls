# Authentication

Surls supports local password sign-in, passkeys, TOTP, one-time backup codes, and optional external identity providers. Passwords use Argon2id. Admin forms use CSRF protection and authenticated sessions use HttpOnly cookies.

## Strengthen an account

Open **Profile → Security** (`/admin/profile`) to register a passkey or start TOTP setup. Scan the QR code or enter the manual key, then verify a current code. Generate backup codes and store them privately; they are shown only when generated and Surls stores hashes rather than the original codes.

## External sign-in

An admin can configure Keycloak or another OIDC provider, plus Google, GitHub, Discord, Microsoft, Facebook, or X, from **Settings → Sign-in methods**. Register the **exact callback URL shown in the Surls provider editor**. New profiles have profile-specific callback paths; do not assume one fixed callback per provider. Link an external account while signed in locally, test it, and only then consider disabling local methods.

Saved provider secrets depend on the stable `AUTH_SECRET`. Back up the database and that secret together. The global External sign-in switch hides and blocks all external providers, and individual profiles can be disabled without deleting their credentials.

For provider setup, Keycloak MFA evidence, callbacks, and recovery, follow the [full external sign-in guide](https://github.com/asetho/Surls/blob/main/docs/external-sign-in.md). For optional login Turnstile, set both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`; setting only one prevents startup.
