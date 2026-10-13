import { createLocalObjectStore } from "./local-disk";
import { createR2ObjectStore } from "./r2";
import type { ObjectStore } from "./types";

export type { ObjectStore } from "./types";
export { createLocalObjectStore, resolveObjectStoreRoot } from "./local-disk";
export { createR2ObjectStore } from "./r2";

export function createObjectStore(): ObjectStore {
  const mode = process.env.OBJECT_STORE ?? "local";
  if (mode === "r2") return createR2ObjectStore();
  return createLocalObjectStore();
}
