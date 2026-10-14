import { describe, expect, it } from "vitest";
import { countSampledColors, renderPersonaPixels, renderPersonaPng } from "./persona";

describe("persona cards", () => {
  it("draws a face instead of a flat color card", () => {
    const alex = renderPersonaPixels("Alex", "The Human Notification");
    expect(countSampledColors(alex)).toBeGreaterThan(8);
    const center = (520 * alex.width + 360) * 4;
    const red = alex.data[center] ?? 0;
    const green = alex.data[center + 1] ?? 0;
    const blue = alex.data[center + 2] ?? 0;
    expect([red, green, blue]).not.toEqual([22, 18, 16]);
  });

  it("gives different people different faces", () => {
    const alex = renderPersonaPng("Alex");
    const sam = renderPersonaPng("Sam");
    expect(Buffer.compare(alex, sam)).not.toBe(0);
  });
});
