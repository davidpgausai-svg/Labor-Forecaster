import { Pool, QueryResultRow } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: <T extends QueryResultRow = Record<string, any>>(text: string, params?: unknown[]) =>
    pool.query<T>(text, params),
  end: () => pool.end(),
};

export default db;
