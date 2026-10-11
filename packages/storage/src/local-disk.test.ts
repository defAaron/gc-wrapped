import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalObjectStore } from "./local-disk";

describe("local object store", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("returns an https signed url and deletes a session prefix", async () => {
    const root = await mkdtemp(join(tmpdir(), "kudos-store-"));
    dirs.push(root);
    const store = createLocalObjectStore(root);
    await store.put("sessions/abc/final.mp4", Buffer.from("video"));
    await store.put("sessions/abc/avatars/a.png", Buffer.from("img"));
    await store.put("sessions/other/final.mp4", Buffer.from("keep"));

    const url = await store.signedGetUrl("sessions/abc/final.mp4", 120);
    expect(url.startsWith("https://")).toBe(true);
    expect(url).toContain("sessions/abc/final.mp4");

    await store.deletePrefix("sessions/abc");
    expect(await store.get("sessions/abc/final.mp4")).toBeNull();
    expect(await store.get("sessions/abc/avatars/a.png")).toBeNull();
    expect((await store.get("sessions/other/final.mp4"))?.toString()).toBe("keep");
  });
});
