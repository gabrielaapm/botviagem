import assert from "node:assert/strict";
import test from "node:test";
import { isInboundSearchRequest, parseBrDate, parseInboundSearch, startsWithBotCommand } from "./parse.ts";
import { resolveCity } from "../geo/cities.ts";

const NOW = new Date("2026-10-07T15:00:00-03:00");
const TZ = "America/Sao_Paulo";

test("detecta pedido de busca", () => {
  assert.equal(
    isInboundSearchRequest("bot, qual voo mais barato saindo de natal pra sao paulo no dia 15/11"),
    true,
  );
  assert.equal(isInboundSearchRequest("oi tudo bem"), false);
  assert.equal(isInboundSearchRequest("tem passagem de recife pra salvador?"), true);
});

test("parse dia específico Natal → São Paulo", () => {
  const parsed = parseInboundSearch(
    "bot, qual voo mais barato saindo de natal pra sao paulo no dia 15/11",
    NOW,
    TZ,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.origin.city, "Natal");
  assert.deepEqual(parsed.origin.codes, ["NAT"]);
  assert.equal(parsed.destination.city, "São Paulo");
  assert.ok(parsed.destination.codes.includes("CGH"));
  assert.ok(parsed.destination.codes.includes("GRU"));
  assert.equal(parsed.scope.kind, "day");
  if (parsed.scope.kind === "day") assert.equal(parsed.scope.date, "2026-11-15");
});

test("parse semana", () => {
  const parsed = parseInboundSearch(
    "bot voo barato de recife pra fortaleza na semana do dia 10/11",
    NOW,
    TZ,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.scope.kind, "week");
  if (parsed.scope.kind === "week") {
    assert.equal(parsed.scope.from, "2026-11-10");
    assert.equal(parsed.scope.to, "2026-11-16");
  }
});

test("pede esclarecimento sem data", () => {
  const parsed = parseInboundSearch("bot voo de natal pra sao paulo", NOW, TZ);
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.reason, "need-clarify");
  assert.ok(parsed.missing.includes("date"));
});

test("cidades e data BR", () => {
  assert.deepEqual(resolveCity("São Paulo")?.codes, ["CGH", "GRU"]);
  assert.equal(parseBrDate("15/11", NOW, TZ), "2026-11-15");
  assert.equal(parseBrDate("01/01", NOW, TZ), "2027-01-01");
});

test("grupo só aceita comando começando com bot", () => {
  assert.equal(startsWithBotCommand("bot, voo mais barato saindo de natal"), true);
  assert.equal(startsWithBotCommand("Bot voo barato"), true);
  assert.equal(startsWithBotCommand("qual voo mais barato"), false);
});
