import { ensureIngest, getIngestStatus } from "../lib/connectome/ingest";

async function main() {
  console.log("FLY ingest starting against official Male CNS v1.0 sources.");
  await ensureIngest();
  console.log(getIngestStatus());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
