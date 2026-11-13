# Email delivery and templates

Site admins configure email under **Settings → Email** (`/admin/settings/email`). Surls uses SMTP for account verification codes, password recovery, and test messages. You can provide SMTP values in the server environment or save a dashboard-managed configuration that overrides them.

## Configure SMTP

Enter the SMTP host and port. Port 465 uses implicit TLS; other ports require STARTTLS. Choose **Use SMTP login** when the server requires it, then enter both a username and password. If the username is an email address, **Sender email** can be left blank to use that address. **From name** is optional.

Select **Check SMTP settings** to test the connection and login without sending an email. A successful check unlocks **Save email settings** for five minutes. Changing a field requires another check. A saved password is encrypted and is never displayed again; leave its field blank to keep it only when the host, port, and username are unchanged. Dashboard settings can be removed to restore the environment configuration.

Use **Test delivery** to send a message to a mailbox or alias that can receive mail. It does not have to be your Surls account address. Site admins can send up to 10 test or preview messages every 15 minutes.

## Customize system emails

Follow **Email templates** from the Email settings page. Each template has a subject, a plain-text body, and an HTML body. Surls includes six templates:

| Template | When it is sent |
| --- | --- |
| Email change verification | Verifying a change to a user's email address. |
| Sign-in provider connection | Verifying a newly connected sign-in provider. |
| Authenticator setup verification | Verifying authenticator setup by email. |
| Password reset | Sending an eligible user a reset link. |
| Password changed | Confirming a successful password reset. |
| SMTP test | Testing message delivery. |

The editor shows the required placeholders for each template. Verification messages require `{{code}}` in both message bodies; password reset requires `{{resetUrl}}`. **Send preview** sends the current, even unsaved, text and HTML versions to the selected recipient with a sample code or inactive reset link. **Restore default** returns a template to its built-in wording. Preview and test messages share the 10-per-15-minute limit.

## Password recovery

After SMTP works, enable **Email password resets** on the Email settings page. Only accounts with an existing local password that have completed a successful password sign-in are eligible; accounts created only through an external provider are not. Reset links expire after 15 minutes. A successful reset signs out existing sessions and keeps TOTP enabled.
