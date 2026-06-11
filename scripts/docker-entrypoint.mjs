import { spawn } from "node:child_process";

const defaultCommand = ["node", "server.js"];
const command = process.argv.slice(2);

function isEnabled(name, defaultValue = true) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function isInsecureAuthSecret(value) {
  const secret = value?.trim() ?? "";
  const insecureSecrets = new Set([
    "change-this-before-production",
    "development-secret-change-before-production",
    "replace-with-at-least-32-random-bytes",
    "replace-with-at-least-32-random-characters",
    "test-secret-that-is-long-enough-for-surls"
  ]);

  if (secret.length < 32) return true;
  if (insecureSecrets.has(secret)) return true;
  if (/replace|change|example|placeholder|secret/i.test(secret)) return true;
  if (new Set(secret).size < 10) return true;
  return false;
}

function validateEnvironment() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  if (isInsecureAuthSecret(process.env.AUTH_SECRET)) {
    throw new Error("AUTH_SECRET must be changed to a high-entropy random value of at least 32 characters.");
  }
}

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      stdio: "inherit",
      env: process.env
    });

    if (options.forwardSignals) {
      const forward = (signal) => {
        if (!child.killed) {
          child.kill(signal);
        }
      };
      process.once("SIGINT", forward);
      process.once("SIGTERM", forward);
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0 || (options.allowSignalExit && signal)) {
        resolve();
        return;
      }

      reject(new Error(`${commandName} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

async function runWithRetries(label, commandName, args) {
  const attempts = Number.parseInt(process.env.SURLS_MIGRATION_ATTEMPTS ?? "10", 10);
  const delayMs = Number.parseInt(process.env.SURLS_MIGRATION_RETRY_DELAY_MS ?? "3000", 10);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.log(`${label}: attempt ${attempt}/${attempts}`);
      await run(commandName, args);
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.log(`${label}: retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  validateEnvironment();

  if (isEnabled("SURLS_RUN_MIGRATIONS")) {
    await runWithRetries("Migrations", "node", ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  } else {
    console.log("Migrations: skipped by SURLS_RUN_MIGRATIONS.");
  }

  if (isEnabled("SURLS_RUN_BOOTSTRAP")) {
    await run("node", ["scripts/bootstrap.mjs"]);
  } else {
    console.log("Bootstrap: skipped by SURLS_RUN_BOOTSTRAP.");
  }

  const [commandName, ...args] = command.length > 0 ? command : defaultCommand;
  await run(commandName, args, { forwardSignals: true, allowSignalExit: true });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
