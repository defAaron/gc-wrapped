import { spawn } from "node:child_process";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureFfmpegForTest, muxAudioOntoVideo, readSlideshowMp4, renderFixtureClip, renderSlideshow, renderStillWithAudio } from "./concat";
import { renderPersonaPng } from "./persona";

function run(args: string[]): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(args[0] ?? "ffmpeg", args.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    let stderr = "";
    proc.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(stdout), stderr });
      else reject(new Error(stderr.slice(-400)));
    });
  });
}

async function sampledColors(file: string): Promise<number> {
  const { stdout } = await run(["ffmpeg", "-v", "error", "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const colors = new Set<number>();
  for (let index = 0; index < stdout.length; index += 3 * 40) {
    const red = stdout[index] ?? 0;
    const green = stdout[index + 1] ?? 0;
    const blue = stdout[index + 2] ?? 0;
    colors.add((red << 16) | (green << 8) | blue);
  }
  return colors.size;
}

async function hasAudio(file: string): Promise<boolean> {
  const { stdout } = await run([
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "a",
    "-show_entries",
    "stream=index",
    "-of",
    "csv=p=0",
    file,
  ]);
  return stdout.toString().trim().length > 0;
}

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

  it("keeps the winner's face on screen for the whole announcement", async () => {
    const hasFfmpeg = await ensureFfmpegForTest();
    if (!hasFfmpeg) return;
    const clip = await renderStillWithAudio(renderPersonaPng("Alex", "Top Texter"), await renderFixtureClip());
    const dir = await mkdtemp(join(tmpdir(), "kudos-persona-check-"));
    const file = join(dir, "clip.mp4");
    await writeFile(file, clip);
    expect(await hasAudio(file)).toBe(true);
    expect(await sampledColors(file)).toBeGreaterThan(8);
  });

  it("lays narration onto a silent stage clip", async () => {
    const hasFfmpeg = await ensureFfmpegForTest();
    if (!hasFfmpeg) return;
    const stage = await renderFixtureClip();
    const muxed = await muxAudioOntoVideo(stage, stage);
    const dir = await mkdtemp(join(tmpdir(), "kudos-mux-check-"));
    const file = join(dir, "clip.mp4");
    await writeFile(file, muxed);
    expect(await hasAudio(file)).toBe(true);
    expect(await sampledColors(file)).toBeGreaterThan(0);
  });
});
