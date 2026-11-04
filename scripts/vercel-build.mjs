// scripts/vercel-build.mjs
// Vercel runs "vercel-build" instead of "build" when it exists.
// Production: apply pending migrations first, then build. Previews: build only.

import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  console.log("[vercel-build] production deploy: applying migrations");
  run("npx prisma migrate deploy"); // a failure stops the deploy; the old version stays live
}
run("npx next build");
