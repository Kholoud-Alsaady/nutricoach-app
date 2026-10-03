// =============================================================================
// DB Setup Script: Applies supabase/schema.sql directly via Postgres connection
// =============================================================================

import "dotenv/config";
import fs from "fs";
import path from "path";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.log("ℹ️  SUPABASE_DB_URL not set in .env.local.");
    console.log("👉 Please paste `supabase/schema.sql` directly into the Supabase SQL Editor.");
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("🚀 Connected to database. Applying supabase/schema.sql...");
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf-8");
  await client.query(sql);

  console.log("✅ Schema applied successfully!");
  await client.end();
}

main().catch(console.error);
