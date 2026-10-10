import fs from "node:fs";
import path from "node:path";

/** Load `.env` from the monorepo root when vars are not already set. */
export function loadRootEnv(): void {
  const repoRoot = path.join(__dirname, "..", "..");
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(repoRoot, name);
    if (!fs.existsSync(envPath)) continue;
    applyEnvFile(envPath);
  }
}

function applyEnvFile(envPath: string): void {
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
