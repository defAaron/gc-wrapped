import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ObjectStore } from "./object-store";

function objectStoreRoot(rootDir = process.env.OBJECT_STORE_DIR ?? ".data"): string {
  const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "..");
  return join(repoRoot, rootDir);
}

export function createLocalObjectStore(rootDir = process.env.OBJECT_STORE_DIR ?? ".data"): ObjectStore {
  const root = objectStoreRoot(rootDir);

  async function pathFor(key: string): Promise<string> {
    const safe = key.replaceAll("..", "").replace(/^\/+/, "");
    const full = join(root, safe);
    if (!full.startsWith(root)) throw new Error("Invalid object key");
    return full;
  }

  return {
    async put(key, body) {
      const file = await pathFor(key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async get(key) {
      const file = await pathFor(key);
      try {
        return await readFile(file);
      } catch {
        return null;
      }
    },
    async delete(key) {
      const file = await pathFor(key);
      await rm(file, { force: true });
    },
    async deletePrefix(prefix) {
      const dir = await pathFor(prefix);
      await rm(dir, { recursive: true, force: true });
    },
  };
}
