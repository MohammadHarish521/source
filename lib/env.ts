import fs from "node:fs";
import path from "node:path";

let loaded = false;

/** Load `.env` into process.env for scripts. Next.js already does this for the app. */
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

export function getNeuprintConfig() {
  loadEnv();
  const token = (process.env.NEUPRINT_TOKEN || process.env.NEUPRINT_APPLICATION_CREDENTIALS || "").trim();
  return {
    token,
    server: (process.env.NEUPRINT_SERVER || "https://neuprint.janelia.org").replace(/\/$/, ""),
    dataset: process.env.NEUPRINT_DATASET || "male-cns:v1.0",
    configured: token.length > 8,
  };
}
