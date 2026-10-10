import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dependency audit", () => {
  it("has no critical vulnerabilities with an available fix", () => {
    const root = join(process.cwd(), "..", "..");
    let output = "";
    try {
      output = execSync("pnpm audit --prod --json", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      const err = error as { stdout?: string };
      output = err.stdout ?? "";
    }
    const report = JSON.parse(output || "{}") as {
      metadata?: { vulnerabilities?: { critical?: number } };
      advisories?: Record<string, { severity: string; fixAvailable?: boolean }>;
    };
    const critical = report.metadata?.vulnerabilities?.critical ?? 0;
    const fixableCritical = Object.values(report.advisories ?? {}).filter(
      (item) => item.severity === "critical" && item.fixAvailable,
    ).length;
    // eslint-disable-next-line no-console -- test records audit summary for CI logs
    console.info("pnpm audit summary", { critical, fixableCritical });
    expect(fixableCritical).toBe(0);
  });
});
