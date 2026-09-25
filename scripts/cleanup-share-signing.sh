#!/usr/bin/env bash
set -uo pipefail

# Run even after a partially completed signing step, before third-party artifact upload.
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
cleanup_status=0
keychain_path="${RUNNER_TEMP}/surls-share-signing.keychain-db"
if [[ -f "${keychain_path}" ]]; then
  security delete-keychain "${keychain_path}" || cleanup_status=1
fi
for signing_path in \
  "${keychain_path}" \
  "${RUNNER_TEMP}/surls-share-developer-id.p12" \
  "${RUNNER_TEMP}/surls-share-app.provisionprofile" \
  "${RUNNER_TEMP}/surls-share-extension.provisionprofile" \
  "${RUNNER_TEMP}/surls-share-app-profile.plist" \
  "${RUNNER_TEMP}/surls-share-extension-profile.plist" \
  "${SURLS_SHARE_APP_PROFILE_PATH:-}" \
  "${SURLS_SHARE_EXTENSION_PROFILE_PATH:-}" \
  "${SURLS_SHARE_NOTARY_KEY_PATH:-}"; do
  [[ -n "${signing_path}" ]] || continue
  rm -f -- "${signing_path}" || cleanup_status=1
done
exit "${cleanup_status}"
