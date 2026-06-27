#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const [key, inlineValue] = arg.slice(2).split("=", 2);
  const next = process.argv[index + 1];
  const value = inlineValue ?? (next && !next.startsWith("--") ? (index += 1, next) : "true");
  args.set(key, value);
}

const host = args.get("host") ?? "root@hmserv";
const remoteDir = args.get("remote-dir") ?? "/opt/surls-theme";
const port = args.get("port") ?? "3100";

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    if (stderr) console.error(stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout?.trim() ?? "";
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

const sha = run("git", ["rev-parse", "--short", "HEAD"], { capture: true });
const dirty = run("git", ["status", "--short"], { capture: true });
if (dirty) {
  console.warn("Deploying a dirty working tree to hmserv; build label will use committed HEAD:", sha);
}

const rsyncExcludes = [
  ".git/",
  "node_modules/",
  ".next/",
  ".env",
  "output/",
  "tsconfig.tsbuildinfo",
  "*.log",
  "www/",
  "docker-compose.override.yml",
  "docker-compose.*.override.yml",
  ".DS_Store"
];

run("rsync", [
  "-az",
  "--delete",
  ...rsyncExcludes.flatMap((exclude) => ["--exclude", exclude]),
  `${repoRoot}/`,
  `${host}:${remoteDir}/`
]);

const quotedRemoteDir = shellQuote(remoteDir);
const quotedSha = shellQuote(sha);
run("ssh", [
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=8",
  host,
  [
    `cd ${quotedRemoteDir}`,
    "test -f .env",
    "cp .env .env.bak.$(date +%Y%m%d%H%M%S)",
    `if grep -q '^SURLS_GIT_SHA=' .env; then sed -i 's/^SURLS_GIT_SHA=.*/SURLS_GIT_SHA=${sha}/' .env; else printf '\\nSURLS_GIT_SHA=%s\\n' ${quotedSha} >> .env; fi`,
    "if ! grep -q '^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=' .env || grep -q '^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$' .env; then key=$(openssl rand -base64 32); if grep -q '^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=' .env; then sed -i \"s|^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=.*|NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$key|\" .env; else printf '\\nNEXT_SERVER_ACTIONS_ENCRYPTION_KEY=%s\\n' \"$key\" >> .env; fi; fi",
    "compose_file_value=$(sed -n 's/^COMPOSE_FILE=//p' .env | tail -n 1); compose_files=''; if [ -n \"$compose_file_value\" ]; then old_ifs=$IFS; IFS=':'; for compose_file in $compose_file_value; do if [ -f \"$compose_file\" ]; then compose_files=\"$compose_files -f $compose_file\"; fi; done; IFS=$old_ifs; fi; if [ -z \"$compose_files\" ]; then compose_files='-f docker-compose.yml'; fi; has_compose_override=0; for override in docker-compose.override.yml docker-compose.*.override.yml; do if [ -f \"$override\" ]; then compose_files=\"$compose_files -f $override\"; has_compose_override=1; fi; done",
    "docker compose $compose_files build app",
    "up_flags='-d --no-build --remove-orphans'; if [ \"$has_compose_override\" = '1' ]; then up_flags=\"$up_flags --no-deps\"; fi",
    "docker compose $compose_files up $up_flags app",
    `for attempt in $(seq 1 30); do if health=$(curl -fsS http://127.0.0.1:${port}/api/health/ready 2>/tmp/surls-health.err); then printf '%s\\n' "$health"; break; fi; if [ "$attempt" = '30' ]; then cat /tmp/surls-health.err >&2; exit 1; fi; sleep 2; done`,
    "docker compose $compose_files ps app"
  ].join(" && ")
]);
