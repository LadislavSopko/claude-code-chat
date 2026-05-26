import { readFileSync, writeFileSync } from "fs";

const result = await Bun.build({
  entrypoints: ["../../src/client.ts"],
  outdir: "./dist",
  target: "bun",
});

if (!result.success) {
  console.error("Build failed:", result.logs);
  process.exit(1);
}

const outPath = "./dist/client.js";
const content = readFileSync(outPath, "utf-8");
writeFileSync(outPath, `#!/usr/bin/env bun\n${content}`);

const { chmodSync } = await import("fs");
chmodSync(outPath, 0o755);

console.log(`Built ${outPath} (${(content.length / 1024).toFixed(0)} KB)`);
