import type { Pool, PoolClient } from "pg";
import type { Actor, Audit, Enquiry, Job, Quote, Records, RecordType, Settings } from "../core/model";
import type { IdentityProvider, WorkStore, WorkTransaction } from "../core/ports";
import { createHash, randomBytes } from "node:crypto";

type Connection = Pool | PoolClient;

const tables: Record<RecordType, string> = { enquiries: "enquiries", quotes: "quotes", jobs: "jobs" };

function repository(db: Connection): WorkTransaction {
  async function find<T>(sql: string, id: string): Promise<T | undefined> {
    const { rows } = await db.query<{ body: T }>(sql, [id]);
    return rows[0]?.body;
  }

  return {
    async settings(lock) {
      const result = await db.query<{ body: Settings }>(`SELECT body FROM settings${lock ? " FOR UPDATE" : ""}`);
      if (!result.rows[0]) throw new Error("Workflow configuration missing. Run database setup.");
      return result.rows[0].body;
    },
    get<K extends RecordType>(kind: K, id: string, lock?: boolean) {
      return find<Records[K]>(`SELECT body FROM ${tables[kind]} WHERE id = $1${lock ? " FOR UPDATE" : ""}`, id);
    },
    async list<K extends RecordType>(kind: K) {
      const { rows } = await db.query<{ body: Records[K] }>(
        `SELECT body FROM ${tables[kind]} ORDER BY body->>'createdAt' DESC, id`,
      );
      return rows.map((row) => row.body);
    },
    enquiryByRef: (ref) => find<Enquiry>("SELECT body FROM enquiries WHERE source_ref = $1", ref),
    quoteByEnquiry: (id) => find<Quote>("SELECT body FROM quotes WHERE enquiry_id = $1", id),
    jobByQuote: (id) => find<Job>("SELECT body FROM jobs WHERE quote_id = $1", id),
    async actors() {
      const { rows } = await db.query<Actor>("SELECT id, role, name FROM demo_users ORDER BY name");
      return rows;
    },
    async auditFor(ids) {
      const { rows } = await db.query<{ id: string; body: Audit }>(
        "SELECT id, body FROM audit_events WHERE entity_id = ANY($1::text[]) ORDER BY id DESC", [ids],
      );
      return rows.map(({ id, body }) => ({ ...body, id }));
    },
    async insert<K extends RecordType>(kind: K, record: Records[K]) {
      const keys = {
        enquiries: { column: "source_ref", value: "sourceRef" },
        quotes: { column: "enquiry_id", value: "enquiryId" },
        jobs: { column: "quote_id", value: "quoteId" },
      } as const;
      const { column, value } = keys[kind];
      const related = (record as Enquiry & Quote & Job)[value];
      const result = await db.query(
        `INSERT INTO ${tables[kind]} (id, ${column}, body) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [record.id, related, record],
      );
      return result.rowCount === 1;
    },
    async update(kind, record) {
      await db.query(`UPDATE ${tables[kind]} SET body = $2 WHERE id = $1`, [record.id, record]);
    },
    async replaceSettings(settings) {
      await db.query("UPDATE settings SET body = $1 WHERE singleton", [settings]);
    },
    async append(event) {
      await db.query("INSERT INTO audit_events (entity_id, body) VALUES ($1, $2)", [event.entityId, event]);
    },
  };
}

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function postgresStore(pool: Pool): WorkStore {
  return {
    read: repository(pool),
    transaction: (operation) => transaction(pool, (client) => operation(repository(client))),
  };
}

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function postgresDemoIdentity(pool: Pool): IdentityProvider {
  return {
    async resolve(token) {
      const { rows } = await pool.query<Actor>(
        `SELECT u.id, u.role, u.name FROM sessions s JOIN demo_users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now()`, [hash(token)],
      );
      return rows[0];
    },
    async switchTo(role, previousToken) {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      await transaction(pool, async (client) => {
        const result = await client.query(
          "INSERT INTO sessions (token_hash, user_id, expires_at) SELECT $1, id, $3 FROM demo_users WHERE role = $2",
          [hash(token), role, expiresAt],
        );
        if (!result.rowCount) throw new Error("Demo user missing. Run database setup.");
        if (previousToken) await client.query("DELETE FROM sessions WHERE token_hash = $1", [hash(previousToken)]);
      });
      return { token, expiresAt };
    },
    async revoke(token) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hash(token)]);
    },
  };
}
