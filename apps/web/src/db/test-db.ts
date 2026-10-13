import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";
import type { Db } from "./types";

let client: PGlite | null = null;
let db: Db | null = null;

export async function initTestDb(): Promise<Db> {
  if (db) return db;
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  await client.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id uuid PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'created',
      roast_level text NOT NULL DEFAULT 'medium',
      group_title text,
      owner_token_hash text NOT NULL,
      consent_at timestamptz,
      expires_at timestamptz NOT NULL,
      raw_deleted_at timestamptz,
      feature_store_json jsonb,
      regenerate_count integer NOT NULL DEFAULT 0,
      publish_quotes boolean NOT NULL DEFAULT false,
      quotes_public boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS members (
      id uuid PRIMARY KEY,
      session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      export_key text NOT NULL,
      display_name text NOT NULL,
      message_count integer NOT NULL DEFAULT 0,
      excluded boolean NOT NULL DEFAULT false,
      avatar_object_key text,
      UNIQUE (session_id, export_key)
    );
    CREATE TABLE IF NOT EXISTS uploads (
      id uuid PRIMARY KEY,
      session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      format_detected text NOT NULL,
      byte_size integer NOT NULL,
      message_count integer NOT NULL,
      member_count integer NOT NULL,
      validation_warnings jsonb NOT NULL DEFAULT '[]',
      parsed_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id uuid PRIMARY KEY,
      session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      feature_version text NOT NULL,
      jev_model text NOT NULL,
      input_tokens integer NOT NULL,
      completed_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS awards (
      id uuid PRIMARY KEY,
      analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
      award_id text NOT NULL,
      title text NOT NULL,
      winner_member_id uuid NOT NULL REFERENCES members(id),
      runner_up_member_id uuid REFERENCES members(id),
      source text NOT NULL,
      receipts jsonb NOT NULL,
      presentation_line text NOT NULL,
      exemplar_quote text,
      jev_confidence real,
      jev_question_id text
    );
    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      id uuid PRIMARY KEY,
      bucket text NOT NULL,
      ip_hash text NOT NULL,
      window_start timestamptz NOT NULL,
      count integer NOT NULL DEFAULT 0,
      UNIQUE (bucket, ip_hash, window_start)
    );
    CREATE TABLE IF NOT EXISTS share_reports (
      id uuid PRIMARY KEY,
      slug text NOT NULL,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ceremonies (
      id uuid PRIMARY KEY,
      session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending',
      video_object_key text,
      duration_sec real,
      fallback_used boolean NOT NULL DEFAULT false,
      mh_credits_total integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      video_expires_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS ceremony_jobs (
      id uuid PRIMARY KEY,
      ceremony_id uuid NOT NULL REFERENCES ceremonies(id) ON DELETE CASCADE,
      type text NOT NULL,
      line_id text,
      external_id text,
      status text NOT NULL DEFAULT 'pending',
      attempt integer NOT NULL DEFAULT 0,
      object_key text,
      script_text text,
      member_export_key text
    );
  `);
  return db;
}

export function getTestDb(): Db {
  if (!db) throw new Error("Test database not initialized");
  return db;
}
