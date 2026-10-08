import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../config/env.ts";
import { DEFAULT_ORIGIN_CODES } from "../config/origins.ts";
import { originsForRun, splitOrigins } from "./jobs.ts";

function cfg(overrides: Partial<ReturnType<typeof loadConfig>> = {}) {
  const base = loadConfig([]);
  return { ...base, searchAdapter: "playwright" as const, ...overrides };
}

test("origens padrão: 8 aeroportos, sem Campinas", () => {
  assert.deepEqual([...DEFAULT_ORIGIN_CODES], ["GRU", "CGH", "GIG", "SDU", "REC", "NAT", "JPA", "SLZ"]);
  assert.equal(DEFAULT_ORIGIN_CODES.includes("VCP"), false);
});

test("8 origens em 4 rodadas = 2 por rodada, cobrindo todas", () => {
  const config = cfg({ origins: [...DEFAULT_ORIGIN_CODES], checkHours: [3, 9, 14, 19] });
  assert.deepEqual(originsForRun(config, 3), ["GRU", "CGH"]);
  assert.deepEqual(originsForRun(config, 9), ["GIG", "SDU"]);
  assert.deepEqual(originsForRun(config, 14), ["REC", "NAT"]);
  assert.deepEqual(originsForRun(config, 19), ["JPA", "SLZ"]);
  const all = [3, 9, 14, 19].flatMap((h) => originsForRun(config, h));
  assert.deepEqual([...all].sort(), [...DEFAULT_ORIGIN_CODES].sort());
});

test("split desigual distribui o resto nas primeiras rodadas", () => {
  assert.deepEqual(splitOrigins(["A", "B", "C", "D", "E"], 4), [["A", "B"], ["C"], ["D"], ["E"]]);
});

test("mais rodadas que origens não deixa rodada vazia", () => {
  const config = cfg({ origins: ["GRU", "REC"], checkHours: [3, 9, 14, 19] });
  for (const h of [3, 9, 14, 19]) assert.ok(originsForRun(config, h).length >= 1);
});

test("mock busca todas as origens", () => {
  const config = cfg({ searchAdapter: "mock", origins: [...DEFAULT_ORIGIN_CODES] });
  assert.equal(originsForRun(config, 3).length, 8);
});
