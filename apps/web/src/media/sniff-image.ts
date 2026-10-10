export function sniffImageType(buffer: Buffer): "jpeg" | "png" | null {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  const start = buffer.subarray(0, 64).toString("utf8").toLowerCase();
  if (start.includes("<svg") || start.includes("<?xml")) return null;
  return null;
}
