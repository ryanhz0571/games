import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const rawBase = process.env.BASE_PATH || "/";
const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

const rawBuildId =
  process.env.VITE_BUILD_ID ||
  process.env.GITHUB_SHA ||
  new Date().toISOString().replace(/[^0-9a-z]/gi, "");
const buildId = rawBuildId.slice(0, 12);

function writeBuildInfo(): void {
  const outDir = resolve(process.cwd(), "dist");
  mkdirSync(outDir, { recursive: true });

  const now = new Date().toISOString();
  writeFileSync(
    resolve(outDir, "version.json"),
    JSON.stringify({ version: buildId, builtAt: now }, null, 2),
  );

  const template = readFileSync(
    resolve(process.cwd(), "scripts/sw.template.js"),
    "utf8",
  );
  const sw = template
    .replaceAll("__BUILD_ID__", buildId)
    .replaceAll("__BASE__", base);
  writeFileSync(resolve(outDir, "sw.js"), sw, "utf8");
}

function buildInfoPlugin(): Plugin {
  return {
    name: "ryan-games-build-info",
    apply: "build",
    closeBundle() {
      writeBuildInfo();
    },
  };
}

export default defineConfig({
  base,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(process.cwd(), "index.html"),
        snake: resolve(process.cwd(), "snake-game/index.html"),
        mathHome: resolve(process.cwd(), "math-game/index.html"),
        mathPlay: resolve(process.cwd(), "math-game/play/index.html"),
      },
    },
  },
  plugins: [buildInfoPlugin()],
});
