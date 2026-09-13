export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { mongoConfigured } = await import("./lib/db");
    if (!mongoConfigured()) {
      console.error("[FLY] MONGODB_URI missing. Create a free Atlas cluster and add it to .env.");
      return;
    }
    const { refreshIngestStatus, ensureIngest } = await import("./lib/connectome/ingest");
    await refreshIngestStatus();
    void ensureIngest().catch((error) => {
      console.error("[FLY mongo]", error);
    });
  }
}
