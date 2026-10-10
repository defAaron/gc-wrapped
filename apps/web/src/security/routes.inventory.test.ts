import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function listRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listRouteFiles(full));
    } else if (entry === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

function toApiPath(routeFile: string, apiRoot: string): string {
  const rel = relative(apiRoot, routeFile).replace(/\\/g, "/");
  const segments = rel
    .replace(/\/route\.ts$/, "")
    .split("/")
    .map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? `:${segment.slice(1, -1)}` : segment));
  return `/api/${segments.join("/")}`;
}

function pathsFromMarkdown(markdown: string): string[] {
  const lines = markdown.split("\n");
  const paths: string[] = [];
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 4 || cells[1] === "Method" || cells[1] === "--------") continue;
    const path = cells[2]?.replace(/`/g, "").trim();
    if (!path || !path.startsWith("/api/")) continue;
    paths.push(path);
  }
  return paths;
}

describe("api route inventory", () => {
  it("lists every route.ts in routes.md", () => {
    const apiRoot = join(process.cwd(), "app/api");
    const routeFiles = listRouteFiles(apiRoot);
    const discovered = routeFiles.map((file) => toApiPath(file, apiRoot)).sort();
    const markdown = readFileSync(join(process.cwd(), "src/security/routes.md"), "utf8");
    const documented = [...new Set(pathsFromMarkdown(markdown))].sort();

    expect(documented).toEqual(discovered);
  });

  it("does not mark owner session GET as public", () => {
    const markdown = readFileSync(join(process.cwd(), "src/security/routes.md"), "utf8");
    expect(markdown).toContain("Owner cookie");
    expect(markdown).not.toMatch(/\| GET \| `\/api\/sessions\/:id` \| Public/);
  });
});
