import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function objectStoreRoot(rootDir = process.env.OBJECT_STORE_DIR ?? ".data"): string {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const repoRoot = join(packageRoot, "..", "..");
  return join(repoRoot, rootDir);
}

export function createObjectStore(rootDir = process.env.OBJECT_STORE_DIR ?? ".data") {
  const root = objectStoreRoot(rootDir);

  async function pathFor(key: string): Promise<string> {
    const safe = key.replaceAll("..", "").replace(/^\/+/, "");
    const full = join(root, safe);
    if (!full.startsWith(root)) throw new Error("Invalid object key");
    return full;
  }

  return {
    async put(key: string, body: Buffer) {
      const file = await pathFor(key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async get(key: string) {
      const file = await pathFor(key);
      try {
        return await readFile(file);
      } catch {
        return null;
      }
    },
    async deletePrefix(prefix: string) {
      const dir = await pathFor(prefix);
      await rm(dir, { recursive: true, force: true });
    },
  };
}
