import assert from "node:assert/strict";
import test from "node:test";
import { formatDateArrow, formatOfferMessage } from "./template.ts";
import type { FlightOffer } from "./types.ts";

const offer: FlightOffer = {
  id: "abc123",
  fingerprint: "fp",
  origin: { code: "CGH", city: "São Paulo" },
  destination: { code: "CWB", city: "Curitiba" },
  departDate: "2026-11-11",
  returnDate: "2026-11-16",
  priceBRL: 219,
  airline: "LATAM",
  stops: 0,
  source: "mock",
  foundAt: "2026-10-07T12:00:00.000Z",
  deepLink: undefined,
  promoScore: 0.4,
  outbound: { departTime: "08:20", arriveTime: "09:25" },
  returnLeg: { departTime: "18:40", arriveTime: "19:45" },
};

test("mensagem segue o padrão de agência com horários", () => {
  const text = formatOfferMessage(offer, "Agência Exemplo");
  assert.equal(
    text,
    [
      "✈️ CURITIBA | R$ 219",
      "",
      "📅 11 → 16/11",
      "✈️ CGH ⇄ Curitiba",
      "⚡ Direto",
      "🕐 08:20 → 09:25",
      "🕐 18:40 → 19:45",
      "",
      "💬 Quer fechar? Me chama no PV.",
      "",
      "Valor sujeito a alteração até a emissão. Bagagem e assento conforme tarifa.",
    ].join("\n"),
  );
  assert.doesNotMatch(text, /QUERO/);
  assert.doesNotMatch(text, /Agência Exemplo/);
});

test("praia usa palmeira e omite horários se não houver", () => {
  const { outbound: _o, returnLeg: _r, ...base } = offer;
  const beach: FlightOffer = {
    ...base,
    id: "beach1",
    destination: { code: "REC", city: "Recife" },
    stops: 1,
  };
  const text = formatOfferMessage(beach);
  assert.match(text, /^🌴 RECIFE \| R\$ 219/m);
  assert.match(text, /⚡ 1 parada/);
  assert.doesNotMatch(text, /🕐/);
});

test("seta de datas no mesmo mês e entre meses", () => {
  assert.equal(formatDateArrow("2026-11-11", "2026-11-16"), "11 → 16/11");
  assert.equal(formatDateArrow("2026-10-28", "2026-11-05"), "28/10 → 5/11");
});
