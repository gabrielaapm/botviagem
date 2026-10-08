import { Cron } from "croner";
import type { Config } from "../config/env.ts";
import { hourInZone } from "../lib/clock.ts";
import { log } from "../lib/log.ts";
import type { OfferPipeline } from "../offers/pipeline.ts";

export function startScheduler(config: Config, pipeline: OfferPipeline): Cron {
  const hours = config.checkHours.join(",");
  const pattern = `0 ${hours} * * *`;
  log.info(`agenda: ${pattern} (${config.timezone})`);
  config.checkHours.forEach((hour, index) => {
    const slot = splitOrigins(config.origins, config.checkHours.length)[index] ?? [];
    log.info(`  ${String(hour).padStart(2, "0")}:00 → ${slot.join(", ") || "(nenhuma)"}`);
  });

  return new Cron(
    pattern,
    { timezone: config.timezone, protect: true },
    () => {
      const hour = hourInZone(new Date(), config.timezone);
      const origins = originsForRun(config, hour);
      log.info(`rodada das ${String(hour).padStart(2, "0")}:00, origens ${origins.join(", ")}`);
      void pipeline.run(origins).catch((err: unknown) => log.error("rodada falhou", err));
    },
  );
}

/**
 * Split origins into `runs` contiguous batches, as even as possible, in .env order.
 * 8 origins / 4 runs → 2 each. Every origin lands in exactly one batch.
 */
export function splitOrigins(origins: readonly string[], runs: number): string[][] {
  const count = Math.max(1, runs);
  const batches: string[][] = Array.from({ length: count }, () => []);
  const base = Math.floor(origins.length / count);
  const extra = origins.length % count;
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const size = base + (i < extra ? 1 : 0);
    batches[i] = origins.slice(cursor, cursor + size);
    cursor += size;
  }
  return batches;
}

export function originsForRun(config: Config, hour: number): string[] {
  if (config.searchAdapter === "mock") return config.origins;
  const batches = splitOrigins(config.origins, config.checkHours.length);
  const index = config.checkHours.indexOf(hour);
  const batch = batches[index >= 0 ? index : 0] ?? [];
  // More runs than origins: some slots are empty — reuse round-robin so no run is idle.
  if (batch.length === 0 && config.origins.length > 0) {
    const i = (index >= 0 ? index : 0) % config.origins.length;
    const code = config.origins[i];
    return code ? [code] : [];
  }
  return batch;
}
