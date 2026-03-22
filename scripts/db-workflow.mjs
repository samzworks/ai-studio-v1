import "dotenv/config";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";

function log(message) {
  console.log(`[db-workflow] ${message}`);
}

function fail(message, code = 1) {
  console.error(`[db-workflow] ERROR: ${message}`);
  process.exit(code);
}

function getArgValue(flag, args) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return null;
  return args[index + 1];
}

function hasFlag(flag, args) {
  return args.includes(flag);
}

function getUrlFromEnvName(envName) {
  const url = process.env[envName];
  if (!url) {
    fail(`Missing environment variable ${envName}.`);
  }
  return url;
}

function maskDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    return parsed.toString();
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

function runCommand(command, args, env) {
  const printable = [command, ...args].join(" ");
  log(`Running: ${printable}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env,
  });
  if (result.status !== 0) {
    fail(`Command failed (${result.status}): ${printable}`, result.status ?? 1);
  }
}

async function checkConnection(url) {
  log(`Checking DB connection: ${maskDatabaseUrl(url)}`);
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 7000,
  });

  try {
    const result = await pool.query(
      "select current_database() as db, current_user as usr, version() as version"
    );
    const row = result.rows[0];
    log(`Connected. db=${row.db}, user=${row.usr}`);
  } finally {
    await pool.end().catch(() => {});
  }
}

function runMigrations(url) {
  const env = { ...process.env, DATABASE_URL: url };
  log(`Applying migrations to: ${maskDatabaseUrl(url)}`);
  runCommand("npx", ["drizzle-kit", "migrate"], env);
}

function runSeedTranslations(url) {
  const env = { ...process.env, DATABASE_URL: url };
  log(`Seeding translations on: ${maskDatabaseUrl(url)}`);
  runCommand("npx", ["tsx", "server/scripts/upsert-translations.cli.ts"], env);
}

function printHelp() {
  console.log(`Usage:
  node scripts/db-workflow.mjs check [--url-env DATABASE_URL]
  node scripts/db-workflow.mjs migrate [--url-env DATABASE_URL] [--seed]
  node scripts/db-workflow.mjs sync [--local-env LOCAL_DATABASE_URL] [--replit-env REPLIT_DATABASE_URL] [--seed]

Examples:
  node scripts/db-workflow.mjs check
  node scripts/db-workflow.mjs migrate --url-env LOCAL_DATABASE_URL --seed
  node scripts/db-workflow.mjs sync --seed
`);
}

async function main() {
  const [, , action, ...args] = process.argv;
  if (
    !action ||
    action === "--help" ||
    action === "-h" ||
    hasFlag("--help", args) ||
    hasFlag("-h", args)
  ) {
    printHelp();
    return;
  }

  if (action === "check") {
    const envName = getArgValue("--url-env", args) || "DATABASE_URL";
    const url = getUrlFromEnvName(envName);
    await checkConnection(url);
    return;
  }

  if (action === "migrate") {
    const envName = getArgValue("--url-env", args) || "DATABASE_URL";
    const shouldSeed = hasFlag("--seed", args);
    const url = getUrlFromEnvName(envName);
    runMigrations(url);
    if (shouldSeed) {
      runSeedTranslations(url);
    }
    return;
  }

  if (action === "sync") {
    const localEnvName = getArgValue("--local-env", args) || "LOCAL_DATABASE_URL";
    const replitEnvName = getArgValue("--replit-env", args) || "REPLIT_DATABASE_URL";
    const shouldSeed = hasFlag("--seed", args);

    const localUrl = getUrlFromEnvName(localEnvName);
    const replitUrl = getUrlFromEnvName(replitEnvName);

    log("Sync step 1/2: local database");
    runMigrations(localUrl);
    if (shouldSeed) runSeedTranslations(localUrl);

    log("Sync step 2/2: replit database");
    runMigrations(replitUrl);
    if (shouldSeed) runSeedTranslations(replitUrl);
    return;
  }

  fail(`Unknown action: ${action}`);
}

main().catch((error) => {
  fail(error?.message || String(error));
});
