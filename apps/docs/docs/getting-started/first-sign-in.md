# First sign-in

Open `/admin` on the domain you configured as `BASE_URL`. Sign in with the initial admin credentials from `.env`, then remove `INITIAL_ADMIN_PASSWORD` and recreate the app as described in the [install guide](install.md).

From the dashboard, choose **Shorten URL** to create a link. Enter a destination URL and optionally a custom alias, title, tags, or notes. You can later change the destination, disable or archive the link, set an expiration or click limit, copy it, or open its QR code. Surls serves redirects at `/:code` and `/s/:code` on your configured domain.

Before sharing links widely, set up [account recovery and additional sign-in methods](../guides/authentication.md), check your [backup plan](../reference/operations.md), and confirm your proxy and TLS configuration.
