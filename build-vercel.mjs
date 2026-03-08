/**
 * Vercel Build Output API v3 build script.
 * 1. Builds the Vite frontend → .vercel/output/static/
 * 2. Bundles the API serverless function with esbuild → .vercel/output/functions/api/trpc.func/
 * 3. Writes config.json with routing rules
 */
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync, readFileSync, appendFileSync } from "fs";
import { join } from "path";

const OUTPUT = ".vercel/output";

if (existsSync(OUTPUT)) {
  rmSync(OUTPUT, { recursive: true });
}

console.log("[1/4] Building frontend with Vite...");
execSync("npx vite build", { stdio: "inherit" });

console.log("[2/4] Copying static files...");
mkdirSync(join(OUTPUT, "static"), { recursive: true });
cpSync("dist/public", join(OUTPUT, "static"), { recursive: true });

const funcDir = join(OUTPUT, "functions/api/trpc.func");
mkdirSync(funcDir, { recursive: true });

console.log("[3/4] Bundling API serverless function...");
execSync(
  `npx esbuild server-entry/trpc.ts --bundle --platform=node --format=cjs --outfile=${join(funcDir, "index.js")} --external:mysql2 --external:mysql2/promise`,
  { stdio: "inherit" }
);

writeFileSync(
  join(funcDir, "package.json"),
  JSON.stringify({ type: "commonjs" })
);

appendFileSync(
  join(funcDir, "index.js"),
  "\n// Vercel handler export\nmodule.exports = module.exports.default || module.exports;\n"
);

const mysql2Src = "node_modules/mysql2";
const mysql2Dest = join(funcDir, "node_modules/mysql2");
if (existsSync(mysql2Src)) {
  console.log("    Copying mysql2 dependency...");
  cpSync(mysql2Src, mysql2Dest, { recursive: true });
  
  const mysql2Deps = [
    "denque", "generate-function", "iconv-lite", "long", "lru.min",
    "named-placeholders", "seq-queue", "sqlstring", "aws-ssl-profiles"
  ];
  for (const dep of mysql2Deps) {
    const src = join("node_modules", dep);
    const dest = join(funcDir, "node_modules", dep);
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true });
    }
  }
}

writeFileSync(
  join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.js",
      launcherType: "Nodejs",
      maxDuration: 30,
      shouldAddHelpers: true,
    },
    null,
    2
  )
);

console.log("[4/4] Writing output config...");
writeFileSync(
  join(OUTPUT, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/api/trpc/(.*)", dest: "/api/trpc" },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2
  )
);

console.log("✅ Build complete! Output in .vercel/output/");
