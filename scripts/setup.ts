import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { Pool } from "pg";
import { defaultWorkflow, demoUsers } from "../demo/fixtures";

nextEnv.loadEnvConfig(process.cwd(), true);
const connectionString = process.env.MIGRATION_DATABASE_URL;
const runtimeRole = process.env.RTC_RUNTIME_ROLE;
if (!connectionString || !runtimeRole || !/^[a-z_][a-z0-9_]*$/.test(runtimeRole)) {
  throw new Error("Set MIGRATION_DATABASE_URL and RTC_RUNTIME_ROLE before running setup.");
}

const pool = new Pool({ connectionString });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(9217321)");
  const { rows: [owner] } = await client.query<{ current_user: string }>("SELECT current_user");
  if (owner.current_user === runtimeRole) throw new Error("Use a distinct database owner and runtime role.");
  await client.query("CREATE TABLE IF NOT EXISTS rtc_migrations (name text PRIMARY KEY)");
  const { rowCount } = await client.query("SELECT name FROM rtc_migrations WHERE name = $1", ["001-initial"]);
  if (!rowCount) {
    await client.query(await readFile(new URL("../db/001-initial.sql", import.meta.url), "utf8"));
    await client.query("INSERT INTO rtc_migrations (name) VALUES ($1)", ["001-initial"]);
  }
  for (const actor of demoUsers) {
    await client.query("INSERT INTO demo_users (id, name, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [actor.id, actor.name, actor.role]);
  }
  await client.query("INSERT INTO settings (body) VALUES ($1) ON CONFLICT DO NOTHING", [defaultWorkflow]);
  await client.query(`
    GRANT USAGE ON SCHEMA public TO "${runtimeRole}";
    GRANT SELECT ON demo_users TO "${runtimeRole}";
    GRANT SELECT, INSERT, DELETE ON sessions TO "${runtimeRole}";
    GRANT SELECT, UPDATE ON settings TO "${runtimeRole}";
    GRANT SELECT, INSERT, UPDATE ON enquiries, quotes, jobs TO "${runtimeRole}";
    REVOKE ALL ON audit_events FROM PUBLIC, "${runtimeRole}";
    GRANT SELECT, INSERT ON audit_events TO "${runtimeRole}";
    GRANT USAGE ON SEQUENCE audit_events_id_seq TO "${runtimeRole}";
  `);
  await client.query("COMMIT");
  console.log("RTC schema, synthetic users and default workflow are ready.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
