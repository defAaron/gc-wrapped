import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScriptLine } from "./script";

export async function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

function slideColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const channel = (n: number) => (hash >> (n * 8)) & 0x7f;
  const r = channel(0) + 32;
  const g = channel(1) + 32;
  const b = channel(2) + 48;
  return `0x${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

async function renderSlide(outputPath: string, seed: string, durationSec: number): Promise<void> {
  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${slideColor(seed)}:s=720x1280:d=${durationSec}`,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    outputPath,
  ]);
}

export async function renderSlideshow(input: {
  groupTitle: string;
  lines: ScriptLine[];
  awardTitles: Map<string, string>;
}): Promise<{ outputPath: string; durationSec: number; cleanupDir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "kudos-ceremony-"));
  const slidePaths: string[] = [];
  const slideDuration = 3;
  let index = 0;

  await renderSlide(join(dir, `slide-${index++}.mp4`), `${input.groupTitle}-intro`, slideDuration);
  slidePaths.push(join(dir, `slide-${index - 1}.mp4`));

  for (const line of input.lines) {
    if (line.id === "intro" || line.id === "outro" || line.id === "speed_round") continue;
    const awardTitle = line.awardId ? input.awardTitles.get(line.awardId) ?? line.awardId : line.id;
    const path = join(dir, `slide-${index++}.mp4`);
    await renderSlide(path, `${awardTitle}-${line.id}`, slideDuration);
    slidePaths.push(path);
  }

  const endPath = join(dir, `slide-${index++}.mp4`);
  await renderSlide(endPath, `kudos-end-${input.groupTitle}`, slideDuration);
  slidePaths.push(endPath);

  const listPath = join(dir, "concat.txt");
  const listBody = slidePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, listBody);

  const outputPath = join(dir, "final.mp4");
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath]);

  const durationSec = slidePaths.length * slideDuration;
  return { outputPath, durationSec, cleanupDir: dir };
}

export async function readSlideshowMp4(result: {
  outputPath: string;
  cleanupDir: string;
}): Promise<Buffer> {
  const body = await readFile(result.outputPath);
  await rm(result.cleanupDir, { recursive: true, force: true }).catch(() => undefined);
  return body;
}

export async function ensureFfmpegForTest(): Promise<boolean> {
  if (process.env.CI) return true;
  return ffmpegAvailable();
}
