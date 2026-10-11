import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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

function findFont(): string | null {
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
  ];
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function escapeDrawtext(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "’");
}

function initialsFromName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

async function probeHasAudio(file: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(
      "ffprobe",
      ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let out = "";
    proc.stdout?.on("data", (chunk) => {
      out += String(chunk);
    });
    proc.on("error", () => resolve(false));
    proc.on("close", () => resolve(out.trim().length > 0));
  });
}

async function probeDuration(file: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let out = "";
    proc.stdout?.on("data", (chunk) => {
      out += String(chunk);
    });
    proc.on("error", () => resolve(0));
    proc.on("close", () => resolve(Number(out.trim()) || 0));
  });
}

const FRAME_FILTER =
  "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30";

async function renderColorClip(outputPath: string, durationSec: number, vf?: string): Promise<void> {
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x1c1917:s=720x1280:d=${durationSec}:r=30`,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-shortest",
    ...(vf ? ["-vf", vf] : []),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    outputPath,
  ];
  if (vf) {
    try {
      await runFfmpeg(args);
      return;
    } catch {
      await runFfmpeg(args.filter((part, index) => part !== "-vf" && args[index - 1] !== "-vf"));
      return;
    }
  }
  await runFfmpeg(args);
}

function drawtextFilter(font: string, text: string, size: number, y: string): string {
  return `drawtext=fontfile=${font}:text='${escapeDrawtext(text)}':fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${y}`;
}

export async function renderInitialsPng(displayName: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "kudos-avatar-"));
  const outputPath = join(dir, "avatar.png");
  const font = findFont();
  const label = initialsFromName(displayName);
  const vf = font ? drawtextFilter(font, label, 160, "(h-text_h)/2") : undefined;
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x44403c:s=720x1280:d=1",
    "-frames:v",
    "1",
    ...(vf ? ["-vf", vf] : []),
    outputPath,
  ];
  try {
    await runFfmpeg(args);
  } catch {
    await runFfmpeg(args.filter((part, index) => part !== "-vf" && args[index - 1] !== "-vf"));
  }
  const body = await readFile(outputPath);
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  return body;
}

export async function renderSpeedRoundCard(text: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "kudos-card-"));
  const outputPath = join(dir, "card.mp4");
  const font = findFont();
  const vf = font
    ? `${drawtextFilter(font, text.slice(0, 180), 36, "(h/2)")},${drawtextFilter(font, "Made with Kudos AI", 28, "h-120")}`
    : undefined;
  await renderColorClip(outputPath, 6, vf);
  const body = await readFile(outputPath);
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  return body;
}

export async function renderFixtureClip(): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "kudos-fixture-"));
  const outputPath = join(dir, "clip.mp4");
  await renderColorClip(outputPath, 1);
  const body = await readFile(outputPath);
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  return body;
}

async function normalizeClip(input: string, output: string): Promise<void> {
  const audio = await probeHasAudio(input);
  if (audio) {
    await runFfmpeg([
      "-y",
      "-i",
      input,
      "-vf",
      FRAME_FILTER,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      output,
    ]);
    return;
  }
  await runFfmpeg([
    "-y",
    "-i",
    input,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-vf",
    FRAME_FILTER,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    output,
  ]);
}

export async function concatVideoBuffers(buffers: Buffer[]): Promise<{ mp4: Buffer; durationSec: number }> {
  const dir = await mkdtemp(join(tmpdir(), "kudos-concat-"));
  const normalized: string[] = [];
  for (let index = 0; index < buffers.length; index += 1) {
    const source = buffers[index];
    if (!source) continue;
    const input = join(dir, `in-${index}.mp4`);
    const output = join(dir, `norm-${index}.mp4`);
    await writeFile(input, source);
    await normalizeClip(input, output);
    normalized.push(output);
  }
  const listPath = join(dir, "concat.txt");
  await writeFile(listPath, normalized.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
  const outputPath = join(dir, "final.mp4");
  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    outputPath,
  ]);
  const mp4 = await readFile(outputPath);
  const durationSec = await probeDuration(outputPath);
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  return { mp4, durationSec };
}
