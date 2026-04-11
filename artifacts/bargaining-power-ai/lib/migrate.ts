import { readFileSync } from "fs";
import { join } from "path";
import db from "./db";

async function migrate() {
  const sql = readFileSync(join(process.cwd(), "lib", "schema.sql"), "utf-8");
  await db.query(sql);
  console.log("✅ Bargaining Power AI schema migrated");
  await db.end();
}

migrate().catch((e) => { console.error(e); process.exit(1); });
