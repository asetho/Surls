# External sign-in

Surls can show separate sign-in buttons for a custom OpenID Connect (OIDC) provider and for Google, GitHub, Discord, Microsoft, Facebook, and X. Each provider is optional and configured independently. Keycloak is supported through the custom OIDC option. Provider credentials stay on the server; never put them in the public webroot or a custom `login.html`.

## Before enabling a provider

1. Set `BASE_URL` to the exact public HTTPS origin of Surls, without a trailing slash. The provider must be reachable from the Surls container over HTTPS. Keep `AUTH_SECRET` stable.
2. Sign in as a site admin, open **Settings → Sign-in methods** (`/admin/settings`), and select the gear. Turn on **External sign-in** if needed, then select **Add provider** and choose a supported provider from the searchable panel. Create a confidential web application in the provider console and register the exact callback URL shown in its editor. Enter its client ID and secret, then select **Save and enable**. The button appears on `/admin` and `/bookmarklet` without a restart. Its text is **Continue with** followed by the configured button label. The OpenID Connect editor also lets you upload a custom SVG, PNG, WebP, or JPEG logo, or paste its raw base64 or `data:image/...;base64,...` value (up to 256 KB); leaving both blank keeps the current logo, and **Remove custom logo** restores the built-in provider icon. Google, GitHub, Discord, Microsoft, Facebook, and X/Twitter always use their built-in logos.
3. Open a private browser window and test the button. Sign in as the site admin, then use **Profile → External sign-in** to connect any provider that does not supply a verified email.
4. If desired, enable automatic user creation in the separate **Sign-in methods** section and select **Save sign-in methods**. It is off by default. A new user receives the **User** role only when the provider supplies a verified email. With this setting off, an admin must first create a Surls user with the same email. The temporary password can be left blank for an external-only user.
5. Only after testing an external sign-in for the site admin, turn off **Allow password and passkey sign-in** and select **Save sign-in methods**. The admin setting refuses to turn this off unless external sign-in is enabled and the current admin has a connected, configured provider. The switch also hides the passkey button and blocks password, pending password 2FA, and passkey authentication and registration routes. External sign-in skips enabled Surls TOTP only when the provider confirms completed MFA; the external TOTP fallback remains available when local login is disabled. Existing sessions and API tokens stay active.

Surls links accounts by the provider's stable subject or user ID. A verified email is used only for the first match or optional user creation. Facebook, X, and Microsoft in this integration do not supply a verified email claim that Surls can rely on, so users must connect them while already signed in. GitHub uses the primary verified email, Discord uses its verified email flag, and OIDC providers must return `email_verified: true`. After the first connection, sign-in uses the provider ID even if an email changes. Provider accounts never grant the Admin role automatically.

You can add more than one profile for the same provider type. Each profile has its own button label, optional logo, client credentials, callback URL, and linked identities. Selecting a type in **Add provider** always starts a new profile with its built-in logo; edit an existing profile from the provider list. Existing profiles keep their callback URLs and linked accounts.

On a development deployment, set `SURLS_LOGIN_DEV_ENABLED=true` and restart Surls to enable the admin-only login preview. Open `/login-dev?custom=yes` to see the active `login.html` or uploaded login template, or `/login-dev?custom=no` to see the built-in page. The preview displays the current provider buttons but disables sign-in interactions. The flag defaults to `false` and should stay off on public deployments.

| Provider | Callback URL | Optional environment values |
| --- | --- | --- |
| Keycloak or other OIDC | `<BASE_URL>/api/auth/external/oidc/callback` | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, optional `OIDC_PROVIDER_NAME` |
| Google | `<BASE_URL>/api/auth/external/google/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `<BASE_URL>/api/auth/external/github/callback` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Discord | `<BASE_URL>/api/auth/external/discord/callback` | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| Microsoft Entra ID | `<BASE_URL>/api/auth/external/microsoft/callback` | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` |
| Facebook Login | `<BASE_URL>/api/auth/external/facebook/callback` | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| X | `<BASE_URL>/api/auth/external/x/callback` | `X_CLIENT_ID`, `X_CLIENT_SECRET` |

## Keycloak example

On the Keycloak server, select or create a realm. Use its public HTTPS realm URL as the issuer, for example `https://auth.example.com/realms/example`; a host alias such as `ed` is not an issuer URL. In **Clients**, create an OpenID Connect client such as `surls`. Enable client authentication and the standard authorization code flow. Set the exact **Valid redirect URI** to `https://links.example.com/api/auth/external/oidc/callback` and **Web origins** to `https://links.example.com`. Copy the issuer, client ID, and client secret into the OpenID Connect editor in Surls Settings, and set the button label to Keycloak. Ensure the `email` and `email_verified` claims are available to the client for first-time matching, and configure MFA in Keycloak if required. The Surls login button goes to Keycloak's sign-in page; any social identity brokers configured in that realm appear there independently of Surls' own social buttons.

If you prefer environment configuration, set these values and restart Surls:

```env
BASE_URL=https://links.example.com
OIDC_ISSUER=https://auth.example.com/realms/example
OIDC_CLIENT_ID=surls
OIDC_CLIENT_SECRET=<secret from Keycloak>
OIDC_PROVIDER_NAME=Keycloak
```

### MFA confirmation and passkeys

Surls reads MFA evidence only from the ID token validated by its HTTPS authorization-code exchange, including issuer, audience, expiration, state, PKCE, and nonce checks. Its `amr` claim must be an array of case-sensitive strings containing `mfa`, or both `pwd` and `otp` ([RFC 8176](https://www.rfc-editor.org/rfc/rfc8176.html)). A verified email, an enrolled authenticator, UserInfo attributes, a bare passkey method, or an arbitrary `acr` value such as `2` does not establish completed MFA. OAuth providers without this ID-token evidence use the Surls TOTP fallback when the Surls account has TOTP enabled. Accounts without Surls TOTP enabled can continue signing in normally.

For Keycloak, add an **Authentication Method Reference (AMR)** protocol mapper to the Surls client's effective client scope and enable **Add to ID token**. Configure authentication execution references to describe methods that actually completed:

- For password plus OTP, use `pwd` on the password execution and `otp` on the OTP execution.
- For a dedicated passwordless WebAuthn/passkey execution, require **User Verification** in the WebAuthn Passwordless Policy. That requires a device PIN or biometric check as well as possession of the passkey. Only an execution that always enforces that verification should report `mfa`.
- Do not attach a constant `mfa` claim to every login or label a combined password/passkey execution as MFA if it can also succeed with a password alone. A touch-only security-key assertion does not prove user verification.

See the [Keycloak authentication guide](https://www.keycloak.org/docs/latest/server_admin/#_authentication-flows) and [AMR mapper reference](https://www.keycloak.org/admin-api/protocol-mappers). Verify the ID-token claim for both the password-plus-OTP and passkey paths in your configured flow before relying on the exemption; Surls does not change Keycloak configuration.

Surls does not request `prompt=login` or `max_age=0`. A new sign-in can reuse a valid Keycloak SSO session whose ID token still reports completed MFA. Keycloak's session and authentication policies control when verification must be repeated; existing Surls sessions are unaffected. If the claim is absent or insufficient, an account with Surls TOTP enabled receives the usual five-minute Surls code challenge before a session is created.

## Other provider setup

- **Google:** Create a Web application OAuth client in Google Cloud, configure its consent screen and the `openid`, `email`, and `profile` scopes, and register the Google callback above. [Google OIDC guide](https://developers.google.com/identity/openid-connect/openid-connect).
- **GitHub:** Create an OAuth app, set its authorization callback URL, and grant `read:user` and `user:email`. Surls reads the primary verified email to match a user. [GitHub OAuth app guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
- **Discord:** Create an application in the Discord Developer Portal, configure its OAuth2 redirect, and allow `identify` and `email`. [Discord OAuth2 guide](https://discord.com/developers/docs/topics/oauth2).
- **Microsoft:** Register a confidential Web app in the Microsoft Entra admin center with the Microsoft callback. Set `MICROSOFT_TENANT_ID` to the tenant GUID or domain, not `common`, so the issuer is pinned. Sign in locally once to connect the Microsoft account from Profile. [Microsoft authorization code guide](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
- **Facebook:** Create a Facebook Login web app in Meta for Developers, register the Facebook callback, and request the `email` permission. Sign in locally once to connect the Facebook account from Profile. The email field can be absent and is not accepted for automatic matching.
- **X:** Create an X Web App with OAuth 2.0 enabled, set the exact X callback, and allow `users.read`. Sign in locally once to connect the X account from Profile. [X authorization code guide](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

Configure only providers you intend to offer. The global **External sign-in** switch hides every external button and blocks external authentication attempts; it cannot be turned off while password and passkey sign-in are disabled. You can also disable an individual profile in Settings without deleting its saved credentials. A Settings profile at the original provider callback URL overrides that provider's environment values; a disabled original profile also keeps its environment-configured counterpart disabled. Additional profiles have their own callback URLs and require their own credentials. To use environment values for the original profile instead, leave it untouched in Settings. Environment changes still require an app restart. Saved secrets are encrypted in the database using `AUTH_SECRET`, so back up the database and keep that secret stable. Settings never displays saved secrets. Each sign-in request uses a short-lived, signed HttpOnly state cookie; OIDC uses a checked ID token and nonce, and providers supporting it use PKCE. Surls does not store provider access tokens.

## Recovery and rollout

Keep a tested admin external connection before disabling local login. Settings refuses to disable or change the current admin's only connected external provider while local login is off. If a provider is unavailable, existing sessions and API tokens continue until they expire or are revoked. An operator with database access can restore `localLoginEnabled` to `true` in the `AppSetting` table and restart if necessary; preserve a database backup before making direct changes. If external login fails, first compare `BASE_URL`, the registered redirect URI, issuer and client credentials, then confirm the provider can be reached from the container. Changing an OIDC issuer or Microsoft tenant changes the identity namespace, so accounts need to reconnect. The Surls app must be released and migrated before configuring live credentials.

Apple, Instagram, and Notion are not included in this first provider set; their account and identity requirements need separate integration work.
