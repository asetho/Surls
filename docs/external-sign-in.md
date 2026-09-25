# External sign-in

Surls can show separate sign-in buttons for a custom OpenID Connect (OIDC) provider and for Google, GitHub, Discord, Microsoft, Facebook, and X. Each provider is optional and configured independently. Keycloak is supported through the custom OIDC option. Provider credentials stay on the server; never put them in the public webroot or a custom `login.html`.

## Before enabling a provider

1. Set `BASE_URL` to the exact public HTTPS origin of Surls, without a trailing slash. The provider must be reachable from the Surls container over HTTPS. Keep `AUTH_SECRET` stable.
2. Create a confidential web application in the provider console. Add the exact callback URL from the table below. Configure its client ID and secret in the Surls environment (`.env` for Compose or 1Panel). Set both values for a provider or leave both empty. Restart the app so the provider appears on `/admin` and `/bookmarklet`.
3. Open a private browser window and test the button. Sign in as the site admin, then use **Profile → External sign-in** to connect any provider that does not supply a verified email.
4. If desired, enable automatic user creation in **Settings → Sign-in methods**. It is off by default. A new user receives the **User** role only when the provider supplies a verified email. With this setting off, an admin must first create a Surls user with the same email. The temporary password can be left blank for an external-only user.
5. Only after testing an external sign-in for the site admin, turn off **Allow password and passkey sign-in**. The admin setting refuses to turn this off unless the current admin has a connected, configured provider. The switch also hides the passkey button and blocks password, pending password 2FA, and passkey authentication and registration routes. Existing Surls TOTP remains required after external sign-in when enabled. Existing sessions and API tokens stay active.

Surls links accounts by the provider's stable subject or user ID. A verified email is used only for the first match or optional user creation. Facebook, X, and Microsoft in this integration do not supply a verified email claim that Surls can rely on, so users must connect them while already signed in. GitHub uses the primary verified email, Discord uses its verified email flag, and OIDC providers must return `email_verified: true`. After the first connection, sign-in uses the provider ID even if an email changes. Provider accounts never grant the Admin role automatically.

| Provider | Callback URL | Required environment values |
| --- | --- | --- |
| Keycloak or other OIDC | `<BASE_URL>/api/auth/external/oidc/callback` | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, optional `OIDC_PROVIDER_NAME` |
| Google | `<BASE_URL>/api/auth/external/google/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `<BASE_URL>/api/auth/external/github/callback` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Discord | `<BASE_URL>/api/auth/external/discord/callback` | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| Microsoft Entra ID | `<BASE_URL>/api/auth/external/microsoft/callback` | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` |
| Facebook Login | `<BASE_URL>/api/auth/external/facebook/callback` | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| X | `<BASE_URL>/api/auth/external/x/callback` | `X_CLIENT_ID`, `X_CLIENT_SECRET` |

## Keycloak example

On the Keycloak server, select or create a realm. Use its public HTTPS realm URL as `OIDC_ISSUER`, for example `https://auth.example.com/realms/example`; a host alias such as `ed` is not an issuer URL. In **Clients**, create an OpenID Connect client such as `surls`. Enable client authentication and the standard authorization code flow. Set the exact **Valid redirect URI** to `https://links.example.com/api/auth/external/oidc/callback` and **Web origins** to `https://links.example.com`. Copy the client secret into `OIDC_CLIENT_SECRET`. Set `OIDC_PROVIDER_NAME=Keycloak` to label the Surls button. Ensure the `email` and `email_verified` claims are available to the client for first-time matching, and configure MFA in Keycloak if required. The Surls login button goes to Keycloak's sign-in page; any social identity brokers configured in that realm appear there independently of Surls' own social buttons.

For example:

```env
BASE_URL=https://links.example.com
OIDC_ISSUER=https://auth.example.com/realms/example
OIDC_CLIENT_ID=surls
OIDC_CLIENT_SECRET=<secret from Keycloak>
OIDC_PROVIDER_NAME=Keycloak
```

## Other provider setup

- **Google:** Create a Web application OAuth client in Google Cloud, configure its consent screen and the `openid`, `email`, and `profile` scopes, and register the Google callback above. [Google OIDC guide](https://developers.google.com/identity/openid-connect/openid-connect).
- **GitHub:** Create an OAuth app, set its authorization callback URL, and grant `read:user` and `user:email`. Surls reads the primary verified email to match a user. [GitHub OAuth app guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).
- **Discord:** Create an application in the Discord Developer Portal, configure its OAuth2 redirect, and allow `identify` and `email`. [Discord OAuth2 guide](https://discord.com/developers/docs/topics/oauth2).
- **Microsoft:** Register a confidential Web app in the Microsoft Entra admin center with the Microsoft callback. Set `MICROSOFT_TENANT_ID` to the tenant GUID or domain, not `common`, so the issuer is pinned. Sign in locally once to connect the Microsoft account from Profile. [Microsoft authorization code guide](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
- **Facebook:** Create a Facebook Login web app in Meta for Developers, register the Facebook callback, and request the `email` permission. Sign in locally once to connect the Facebook account from Profile. The email field can be absent and is not accepted for automatic matching.
- **X:** Create an X Web App with OAuth 2.0 enabled, set the exact X callback, and allow `users.read`. Sign in locally once to connect the X account from Profile. [X authorization code guide](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

Configure only providers you intend to offer. A pair of missing credentials keeps that button hidden. Each sign-in request uses a short-lived, signed HttpOnly state cookie; OIDC uses a checked ID token and nonce, and providers supporting it use PKCE. Surls does not store provider access tokens.

## Recovery and rollout

Keep a tested admin external connection before disabling local login. If a provider is unavailable, existing sessions and API tokens continue until they expire or are revoked. An operator with database access can restore `localLoginEnabled` to `true` in the `AppSetting` table and restart if necessary; preserve a database backup before making direct changes. If external login fails, first compare `BASE_URL`, the registered redirect URI, issuer and client credentials, then confirm the provider can be reached from the container. The Surls app must be released and migrated before configuring live credentials.

Apple, Instagram, and Notion are not included in this first provider set; their account and identity requirements need separate integration work.
