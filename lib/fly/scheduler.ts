import { ensureDailyRun } from "./daily";

const state = globalThis as typeof globalThis & { __flyDailyTimer?: ReturnType<typeof setInterval> };

// Runs only while a persistent Node server is alive; this is not an external cron service.
export function startDailyTraining() {
  if (state.__flyDailyTimer) return;
  const tick = () => void ensureDailyRun().catch(error => console.error("[FLY daily training]", error));
  state.__flyDailyTimer = setInterval(tick, 60000);
  state.__flyDailyTimer.unref();
  tick();
}
