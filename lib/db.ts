// Database access. Neon Postgres when DATABASE_URL is set, otherwise a PGlite folder at
// .data/galli (local runs and tests only; never production).
//
// Every query from the app runs inside withOwner() or withSystem(). Both open a transaction,
// SET LOCAL ROLE galli_app (a role that owns nothing, so row level security applies even with
// one connection string) and set app.owner_id / app.role with set_config(..., true).
import { MIGRATIONS } from "./migrations";

export type Row = Record<string, unknown>;
export interface Q {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}
interface Raw {
  kind: "neon" | "pglite";
  exec(sql: string): Promise<void>;
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
}

type G = { __galliDb?: Promise<Raw> };
const g = globalThis as unknown as G;

export function rawDb(): Promise<Raw> {
  if (!g.__galliDb) {
    g.__galliDb = open().catch((err) => {
      g.__galliDb = undefined;
      throw err;
    });
  }
  return g.__galliDb;
}

async function open(): Promise<Raw> {
  const url = process.env.DATABASE_URL;
  let raw: Raw;
  if (url) {
    const { Pool } = await import("@neondatabase/serverless");
    const pool = new Pool({ connectionString: url, max: 4 });
    raw = {
      kind: "neon",
      async exec(sql) {
        const c = await pool.connect();
        try {
          await c.query(sql);
        } finally {
          c.release();
        }
      },
      async tx(fn) {
        const c = await pool.connect();
        try {
          await c.query("begin");
          const out = await fn({
            async query<R>(sql: string, params: unknown[] = []) {
              return (await c.query(sql, params as unknown[])).rows as R[];
            },
          });
          await c.query("commit");
          return out;
        } catch (e) {
          await c.query("rollback").catch(() => {});
          throw e;
        } finally {
          c.release();
        }
      },
    };
  } else {
    if (process.env.VERCEL) throw new Error("DATABASE_URL is required on Vercel");
    const { PGlite } = await import("@electric-sql/pglite");
    const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
    const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
    const dir = process.env.PGLITE_DIR ?? "./.data/galli";
    if (dir !== "memory") (await import("node:fs")).mkdirSync(dir, { recursive: true });
    const pg = dir === "memory" ? new PGlite({ extensions: { btree_gist, pg_trgm } }) : new PGlite(dir, { extensions: { btree_gist, pg_trgm } });
    await pg.waitReady;
    // PGlite runs one connection; serialise transactions so concurrent requests queue.
    let chain: Promise<unknown> = Promise.resolve();
    raw = {
      kind: "pglite",
      async exec(sql) {
        await pg.exec(sql);
      },
      tx<T>(fn: (q: Q) => Promise<T>) {
        const run = chain.then(() =>
          pg.transaction(async (t) =>
            fn({
              async query<R>(sql: string, params: unknown[] = []) {
                return (await t.query(sql, params as unknown[])).rows as R[];
              },
            }),
          ),
        );
        chain = run.catch(() => {});
        return run as Promise<T>;
      },
    };
  }
  await migrate(raw);
  const { ensureDemos } = await import("./seed");
  await ensureDemos((fn) => asSystem(raw, fn));
  return raw;
}

async function migrate(raw: Raw) {
  await raw.exec(`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);
  for (const m of MIGRATIONS) {
    await raw.tx(async (q) => {
      await q.query("select pg_advisory_xact_lock(424242)");
      const done = await q.query("select 1 from _migrations where name = $1", [m.name]);
      if (done.length) return;
      for (const stmt of splitSql(m.sql)) await q.query(stmt);
      await q.query("insert into _migrations (name) values ($1)", [m.name]);
    });
  }
}

/** Splits a migration on semicolons that are not inside $$ blocks or quotes. */
export function splitSql(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inDollar = false;
  let inQuote = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (!inQuote && sql.startsWith("$$", i)) {
      inDollar = !inDollar;
      cur += "$$";
      i++;
      continue;
    }
    if (!inDollar && ch === "'") inQuote = !inQuote;
    if (ch === ";" && !inDollar && !inQuote) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((s) => !/^(--[^\n]*\n?\s*)*$/.test(s));
}

/** Runs fn as one owner. RLS limits every table to that owner's rows. */
export async function withOwner<T>(ownerId: string, fn: (q: Q) => Promise<T>): Promise<T> {
  const raw = await rawDb();
  return raw.tx(async (q) => {
    await q.query("set local role galli_app");
    await q.query("select set_config('app.owner_id', $1, true), set_config('app.role', 'owner', true)", [ownerId]);
    return fn(q);
  });
}

/** Runs fn with the system role: visitor writes (after validation and rate limits), public reads, jobs. */
export async function withSystem<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  return asSystem(await rawDb(), fn);
}

export type SystemRunner = <T>(fn: (q: Q) => Promise<T>) => Promise<T>;

function asSystem<T>(raw: Raw, fn: (q: Q) => Promise<T>): Promise<T> {
  return raw.tx(async (q) => {
    await q.query("set local role galli_app");
    await q.query("select set_config('app.role', 'system', true), set_config('app.owner_id', '', true)");
    return fn(q);
  });
}

export function pgCode(e: unknown): string | undefined {
  const c = (e as { code?: unknown })?.code;
  return typeof c === "string" ? c : undefined;
}
