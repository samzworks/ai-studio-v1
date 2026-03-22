import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool as NodePgPool } from 'pg';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const DATABASE_URL = process.env.DATABASE_URL;

function getDatabaseHost(connectionString: string): string | null {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const databaseHost = getDatabaseHost(DATABASE_URL);
const isLocalHost =
  databaseHost === "localhost" ||
  databaseHost === "127.0.0.1" ||
  databaseHost === "::1";

// Neon serverless driver is intended for Neon-hosted Postgres.
// For local Postgres and Replit-hosted Postgres, use node-postgres.
const isNeonHost = !!databaseHost && (
  databaseHost.includes("neon.tech") ||
  databaseHost.includes("neon.database")
);

const dbDriverOverride = process.env.DB_DRIVER?.toLowerCase();
const useNeonServerless =
  dbDriverOverride === "neon" ||
  (dbDriverOverride !== "pg" && isNeonHost);

const poolConfig = {
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500,
  allowExitOnIdle: false,
};

export const pool = useNeonServerless
  ? (() => {
      neonConfig.webSocketConstructor = ws;
      return new NeonPool(poolConfig);
    })()
  : new NodePgPool(poolConfig);

export const db = useNeonServerless
  ? drizzleNeon({ client: pool as NeonPool, schema })
  : drizzleNodePg({ client: pool as NodePgPool, schema });

console.log(
  `[DB] Using ${useNeonServerless ? "neon-serverless" : "node-postgres"} driver` +
    (databaseHost ? ` (host: ${databaseHost})` : "") +
    (isLocalHost ? " [local]" : "")
);

export async function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
