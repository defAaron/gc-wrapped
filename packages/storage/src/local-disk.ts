import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { ObjectStore } from "./types";

function repoRoot(): string {
  let dir = process.cwd();
  for (let hop = 0; hop < 6; hop += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function resolveObjectStoreRoot(rootDir = process.env.OBJECT_STORE_DIR ?? ".data"): string {
  if (rootDir.startsWith("/")) return resolve(rootDir);
  return resolve(repoRoot(), rootDir);
}

export function createLocalObjectStore(rootDir = process.env.OBJECT_STORE_DIR ?? ".data"): ObjectStore {
  const root = resolveObjectStoreRoot(rootDir);

  function pathFor(key: string): string {
    const safe = key.replaceAll("..", "").replace(/^\/+/, "");
    const full = resolve(root, safe);
    if (full !== root && !full.startsWith(root + sep)) throw new Error("Invalid object key");
    return full;
  }

  return {
    async put(key, body) {
      const file = pathFor(key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async get(key) {
      try {
        return await readFile(pathFor(key));
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
    async deletePrefix(prefix) {
      await rm(pathFor(prefix), { recursive: true, force: true });
    },
    async signedGetUrl(key, ttlSeconds) {
      const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
      const path = key
        .replaceAll("..", "")
        .replace(/^\/+/, "")
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      return `https://objects.local.invalid/${path}?exp=${exp}`;
    },
  };
}
