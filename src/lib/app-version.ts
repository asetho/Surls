import packageJson from "../../package.json";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version ?? "unknown";

function normalizeGitSha(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 12);
}

function firstValue(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim());
}

export const APP_GIT_SHA = normalizeGitSha(
  firstValue(
    process.env.NEXT_PUBLIC_GIT_SHA,
    process.env.SURLS_GIT_SHA,
    process.env.GITHUB_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA
  )
);

export const APP_BUILD_LABEL = APP_GIT_SHA ? `git ${APP_GIT_SHA}` : "";
