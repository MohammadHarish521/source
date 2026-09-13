export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureIngest } = await import("./lib/connectome/ingest");
    void ensureIngest().catch((error) => {
      console.error("[FLY ingest]", error);
    });
  }
}
