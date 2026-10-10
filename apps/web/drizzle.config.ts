import { defineConfig } from "drizzle-kit";
import { loadRootEnv } from "./load-root-env";

loadRootEnv();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://kudos:kudos@localhost:5432/kudos",
  },
});
