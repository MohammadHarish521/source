import { ensureDailyRun, probeNeuprint } from "../lib/fly/daily";

async function main() {
  const probe = await probeNeuprint();
  console.log("neuprint", probe.ok ? "live" : probe.error);
  if (probe.neuron) {
    console.log("probe", probe.neuron.bodyId, probe.neuron.type, probe.neuron.instance);
  }
  const run = await ensureDailyRun();
  console.log(JSON.stringify({ day: run.day, found: run.found, hops: run.hops, shortest: run.shortest, neuprint: run.neuprint }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
