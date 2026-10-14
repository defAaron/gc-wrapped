import { crc32, deflateSync } from "node:zlib";

type Rgb = readonly [number, number, number];

type Canvas = {
  width: number;
  height: number;
  data: Uint8Array;
};

const STAGE: Rgb = [22, 18, 16];
const SKINS: Rgb[] = [
  [255, 224, 196],
  [240, 198, 150],
  [224, 172, 110],
  [198, 134, 72],
  [150, 96, 52],
  [102, 66, 40],
];
const HAIRS: Rgb[] = [
  [42, 32, 28],
  [92, 58, 32],
  [176, 92, 42],
  [28, 28, 32],
  [212, 176, 84],
  [150, 42, 48],
];
const SHIRTS: Rgb[] = [
  [196, 54, 62],
  [42, 96, 184],
  [36, 140, 96],
  [232, 164, 48],
  [120, 72, 184],
  [48, 64, 92],
];
const EYES: Rgb[] = [
  [46, 92, 156],
  [72, 48, 28],
  [42, 120, 78],
  [72, 72, 80],
];

const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b10010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
  "6": [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0b01110, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b00100, 0b00100],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  "?": [0b01110, 0b10001, 0b00010, 0b00100, 0b00100, 0, 0b00100],
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (const char of input.trim().toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(hash: number, list: T[]): T {
  const item = list[hash % list.length];
  if (item === undefined) throw new Error("empty_palette");
  return item;
}

function createCanvas(width: number, height: number, color: Rgb): Canvas {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = 255;
  }
  return { width, height, data };
}

function put(canvas: Canvas, x: number, y: number, color: Rgb): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return;
  const index = (py * canvas.width + px) * 4;
  canvas.data[index] = color[0];
  canvas.data[index + 1] = color[1];
  canvas.data[index + 2] = color[2];
  canvas.data[index + 3] = 255;
}

function fillEllipse(canvas: Canvas, cx: number, cy: number, rx: number, ry: number, color: Rgb): void {
  if (rx <= 0 || ry <= 0) return;
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(canvas, x, y, color);
    }
  }
}

function fillCircle(canvas: Canvas, cx: number, cy: number, radius: number, color: Rgb): void {
  fillEllipse(canvas, cx, cy, radius, radius, color);
}

function strokeCircle(canvas: Canvas, cx: number, cy: number, radius: number, thickness: number, color: Rgb): void {
  const outer = radius * radius;
  const inner = Math.max(0, radius - thickness);
  const inner2 = inner * inner;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(canvas.width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(canvas.height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = dx * dx + dy * dy;
      if (distance <= outer && distance >= inner2) put(canvas, x, y, color);
    }
  }
}

function fillRect(canvas: Canvas, x: number, y: number, width: number, height: number, color: Rgb): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvas.width, Math.ceil(x + width));
  const y1 = Math.min(canvas.height, Math.ceil(y + height));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) put(canvas, px, py, color);
  }
}

function labelText(text: string): string {
  return text
    .toUpperCase()
    .replaceAll("’", "'")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .split("")
    .filter((char) => FONT[char])
    .join("")
    .slice(0, 28);
}

function textWidth(text: string, scale: number): number {
  return labelText(text).length * 6 * scale;
}

function drawText(canvas: Canvas, text: string, x: number, y: number, scale: number, color: Rgb): void {
  let cursor = x;
  for (const char of labelText(text)) {
    const glyph = FONT[char];
    if (!glyph) {
      cursor += 6 * scale;
      continue;
    }
    for (let row = 0; row < glyph.length; row += 1) {
      const bits = glyph[row] ?? 0;
      for (let col = 0; col < 5; col += 1) {
        if ((bits & (1 << (4 - col))) === 0) continue;
        fillRect(canvas, cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

function drawCentered(canvas: Canvas, text: string, y: number, scale: number, color: Rgb): void {
  const width = textWidth(text, scale);
  const fitted = width > canvas.width - 32 ? Math.max(2, Math.floor(((canvas.width - 32) / Math.max(1, labelText(text).length)) / 6)) : scale;
  const drawn = textWidth(text, fitted);
  drawText(canvas, text, Math.max(16, (canvas.width - drawn) / 2), y, fitted, color);
}

function paintPersona(canvas: Canvas, cx: number, cy: number, radius: number, seedName: string): void {
  const hash = hashString(seedName || "friend");
  const skin = pick(hash, SKINS);
  const hair = pick(hash >>> 3, HAIRS);
  const shirt = pick(hash >>> 6, SHIRTS);
  const eye = pick(hash >>> 9, EYES);
  const style = hash % 4;
  const look = (hash >>> 12) % 2 === 0 ? -1 : 1;
  const blush: Rgb = [Math.min(255, skin[0] + 24), Math.max(0, skin[1] - 20), Math.max(0, skin[2] - 24)];
  const lip: Rgb = [Math.max(0, skin[0] - 50), Math.max(0, skin[1] - 80), Math.max(0, skin[2] - 70)];

  fillEllipse(canvas, cx, cy - radius * 0.1, radius * 1.55, radius * 1.85, [58, 40, 28]);
  fillRect(canvas, cx - radius * 0.85, cy + radius * 1.2, radius * 1.7, radius * 0.85, [122, 78, 42]);
  fillEllipse(canvas, cx, cy + radius * 1.05, radius * 1.05, radius * 0.72, shirt);
  fillRect(canvas, cx - radius * 0.14, cy + radius * 0.55, radius * 0.28, radius * 0.42, skin);

  if (style === 1) {
    fillEllipse(canvas, cx - radius * 0.72, cy + radius * 0.45, radius * 0.28, radius * 0.62, hair);
    fillEllipse(canvas, cx + radius * 0.72, cy + radius * 0.45, radius * 0.28, radius * 0.62, hair);
  }

  fillCircle(canvas, cx, cy - radius * 0.02, radius, hair);
  const faceShift = style === 3 ? radius * 0.16 : radius * 0.08;
  const faceRadius = style === 3 ? radius * 0.8 : radius * 0.86;
  fillCircle(canvas, cx, cy + faceShift, faceRadius, skin);
  fillCircle(canvas, cx - radius * 1.02, cy + faceShift, radius * 0.14, skin);
  fillCircle(canvas, cx + radius * 1.02, cy + faceShift, radius * 0.14, skin);

  if (style === 2) fillCircle(canvas, cx + radius * 0.35, cy - radius * 0.95, radius * 0.28, hair);

  const eyeY = cy - radius * 0.02;
  const eyeDx = radius * 0.32;
  for (const side of [-1, 1]) {
    fillCircle(canvas, cx + side * eyeDx, eyeY, radius * 0.16, [255, 255, 255]);
    fillCircle(canvas, cx + side * eyeDx + look * radius * 0.04, eyeY + radius * 0.02, radius * 0.08, eye);
    fillCircle(canvas, cx + side * eyeDx + look * radius * 0.02, eyeY - radius * 0.02, radius * 0.03, [255, 255, 255]);
    const browLift = side === look ? radius * 0.04 : 0;
    fillEllipse(canvas, cx + side * eyeDx, eyeY - radius * 0.28 - browLift, radius * 0.16, radius * 0.045, hair);
  }

  fillEllipse(canvas, cx, cy + radius * 0.22, radius * 0.06, radius * 0.1, [Math.max(0, skin[0] - 35), Math.max(0, skin[1] - 30), Math.max(0, skin[2] - 25)]);
  fillEllipse(canvas, cx, cy + radius * 0.42, radius * 0.22, radius * 0.12, lip);
  fillEllipse(canvas, cx, cy + radius * 0.36, radius * 0.22, radius * 0.1, skin);
  fillCircle(canvas, cx - radius * 0.48, cy + radius * 0.22, radius * 0.1, blush);
  fillCircle(canvas, cx + radius * 0.48, cy + radius * 0.22, radius * 0.1, blush);
  fillCircle(canvas, cx, cy + radius * 1.02, radius * 0.16, [232, 186, 64]);

  if ((hash >>> 15) % 3 === 0) {
    strokeCircle(canvas, cx - eyeDx, eyeY, radius * 0.2, Math.max(2, radius * 0.035), [36, 36, 40]);
    strokeCircle(canvas, cx + eyeDx, eyeY, radius * 0.2, Math.max(2, radius * 0.035), [36, 36, 40]);
    fillRect(canvas, cx - radius * 0.12, eyeY - radius * 0.025, radius * 0.24, Math.max(2, radius * 0.04), [36, 36, 40]);
  }
}

function encodePng(canvas: Canvas): Buffer {
  const stride = canvas.width * 4;
  const raw = Buffer.alloc((stride + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const offset = y * (stride + 1);
    raw[offset] = 0;
    raw.set(canvas.data.subarray(y * stride, y * stride + stride), offset + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, checksum]);
}

export function renderPersonaPixels(displayName: string, caption = ""): Canvas {
  const canvas = createCanvas(720, 1280, STAGE);
  paintPersona(canvas, 360, 520, 200, displayName);
  drawCentered(canvas, displayName.trim() || "Friend", 1020, 7, [255, 248, 240]);
  if (caption.trim()) drawCentered(canvas, caption.trim(), 1110, 4, [244, 208, 120]);
  return canvas;
}

export function renderPersonaPng(displayName: string, caption = ""): Buffer {
  return encodePng(renderPersonaPixels(displayName, caption));
}

export function renderPersonaGridPng(names: string[]): Buffer {
  const canvas = createCanvas(720, 1280, STAGE);
  drawCentered(canvas, "Speed round", 70, 6, [255, 248, 240]);
  const people = names.length > 0 ? names : ["Friend"];
  const cols = people.length <= 1 ? 1 : people.length <= 4 ? 2 : 3;
  const rows = Math.ceil(people.length / cols);
  const top = 180;
  const cellW = 720 / cols;
  const cellH = Math.min(340, (1000 / rows));
  people.forEach((name, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cx = col * cellW + cellW / 2;
    const cy = top + row * cellH + cellH * 0.38;
    const radius = Math.min(cellW, cellH) * 0.28;
    paintPersona(canvas, cx, cy, radius, name);
    const scale = name.length > 12 ? 2 : 3;
    const width = textWidth(name, scale);
    drawText(canvas, name, cx - width / 2, cy + radius + 16, scale, [255, 248, 240]);
  });
  return encodePng(canvas);
}

export function countSampledColors(canvas: Canvas): number {
  const colors = new Set<number>();
  for (let index = 0; index < canvas.data.length; index += 4 * 24) {
    const red = canvas.data[index] ?? 0;
    const green = canvas.data[index + 1] ?? 0;
    const blue = canvas.data[index + 2] ?? 0;
    colors.add((red << 16) | (green << 8) | blue);
  }
  return colors.size;
}
