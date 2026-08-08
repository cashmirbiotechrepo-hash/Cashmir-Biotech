/**
 * Verifies that write-amplify-runtime-env.cjs successfully baked env vars.
 * Called from amplify.yml after the bake step.
 */
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const file = resolve(process.cwd(), "src/generated/amplify-runtime-env.json");
if (!existsSync(file)) {
  console.error("[verify-baked-env] ERROR: amplify-runtime-env.json not found!");
  process.exit(1);
}

const baked = require(file);
const keys = Object.keys(baked);
console.log("[verify-baked-env] Baked " + keys.length + " keys: " + keys.join(", "));

const required = ["JWT_SECRET", "ENCRYPTION_KEY", "PASSWORD_PEPPER", "POW_SECRET", "DATABASE_URL"];
let missing = 0;
for (const k of required) {
  if (!baked[k]) {
    console.error("[verify-baked-env] MISSING: " + k);
    missing++;
  } else {
    console.log("[verify-baked-env] OK: " + k + " (" + String(baked[k]).length + " chars)");
  }
}

if (missing > 0) {
  console.error("[verify-baked-env] " + missing + " required key(s) missing from baked env!");
  console.error("[verify-baked-env] Check Amplify Console -> App settings -> Environment variables");
  process.exit(1);
}

console.log("[verify-baked-env] All required keys present.");
