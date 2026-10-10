import { randomUUID } from "node:crypto";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const uuidPk = () => uuid("id").primaryKey().$defaultFn(() => randomUUID());

export const sessions = pgTable("sessions", {
  id: uuidPk(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("created"),
  roastLevel: text("roast_level").notNull().default("medium"),
  groupTitle: text("group_title"),
  ownerTokenHash: text("owner_token_hash").notNull(),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  rawDeletedAt: timestamp("raw_deleted_at", { withTimezone: true }),
  featureStoreJson: jsonb("feature_store_json"),
  regenerateCount: integer("regenerate_count").notNull().default(0),
  publishQuotes: boolean("publish_quotes").notNull().default(false),
  quotesPublic: boolean("quotes_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuidPk(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    exportKey: text("export_key").notNull(),
    displayName: text("display_name").notNull(),
    messageCount: integer("message_count").notNull().default(0),
    excluded: boolean("excluded").notNull().default(false),
    avatarObjectKey: text("avatar_object_key"),
  },
  (table) => [uniqueIndex("members_session_export").on(table.sessionId, table.exportKey)],
);

export const uploads = pgTable("uploads", {
  id: uuidPk(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  formatDetected: text("format_detected").notNull(),
  byteSize: integer("byte_size").notNull(),
  messageCount: integer("message_count").notNull(),
  memberCount: integer("member_count").notNull(),
  validationWarnings: jsonb("validation_warnings").$type<string[]>().notNull().default([]),
  parsedAt: timestamp("parsed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyses = pgTable("analyses", {
  id: uuidPk(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  featureVersion: text("feature_version").notNull(),
  jevModel: text("jev_model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const awards = pgTable("awards", {
  id: uuidPk(),
  analysisId: uuid("analysis_id")
    .notNull()
    .references(() => analyses.id, { onDelete: "cascade" }),
  awardId: text("award_id").notNull(),
  title: text("title").notNull(),
  winnerMemberId: uuid("winner_member_id")
    .notNull()
    .references(() => members.id),
  runnerUpMemberId: uuid("runner_up_member_id").references(() => members.id),
  source: text("source").notNull(),
  receipts: jsonb("receipts").$type<string[]>().notNull(),
  presentationLine: text("presentation_line").notNull(),
  exemplarQuote: text("exemplar_quote"),
  jevConfidence: real("jev_confidence"),
  jevQuestionId: text("jev_question_id"),
});

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    id: uuidPk(),
    bucket: text("bucket").notNull(),
    ipHash: text("ip_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [uniqueIndex("rate_limit_unique").on(table.bucket, table.ipHash, table.windowStart)],
);

export const shareReports = pgTable("share_reports", {
  id: uuidPk(),
  slug: text("slug").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
