import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureFfmpegForTest, readSlideshowMp4, renderSlideshow } from "./concat";

describe("slideshow fallback", () => {
  it("writes a non-empty mp4", async () => {
    const hasFfmpeg = await ensureFfmpegForTest();
    if (!hasFfmpeg) return;

    const outDir = await mkdtemp(join(tmpdir(), "kudos-slideshow-test-"));
    process.env.OBJECT_STORE_DIR = outDir;

    const rendered = await renderSlideshow({
      groupTitle: "Test Group",
      lines: [
        { id: "intro", text: "Welcome" },
        { id: "headline_most_messages", text: "Alex wins", awardId: "most_messages" },
        { id: "outro", text: "Bye" },
      ],
      awardTitles: new Map([["most_messages", "Top Texter"]]),
    });

    const fileStat = await stat(rendered.outputPath);
    expect(fileStat.size).toBeGreaterThan(0);
    const body = await readSlideshowMp4(rendered);
    expect(body.byteLength).toBeGreaterThan(0);
  });
});
