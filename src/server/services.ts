import { randomUUID } from "node:crypto";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { exampleRate } from "../../demo/fixtures";
import { mockRate } from "../adapters/mock-rate";
import { postgresDemoIdentity, postgresStore } from "../adapters/postgres";
import { createWorkflow } from "../core/workflow";

function createServices() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to run the workspace.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 8000 });
  pool.on("error", () => console.error("RTC database pool connection interrupted."));
  if (process.env.VERCEL) attachDatabasePool(pool);
  const store = postgresStore(pool);
  return {
    identity: postgresDemoIdentity(pool),
    workflow: createWorkflow({ store, rates: mockRate(exampleRate), id: randomUUID, now: () => new Date() }),
  };
}

let instance: ReturnType<typeof createServices> | undefined;

export function services() {
  return instance ??= createServices();
}
