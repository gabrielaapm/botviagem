import assert from "node:assert/strict";
import test from "node:test";
import { buildGoogleFlightsUrl, ensureDeepLink, formatAdminDm } from "./deeplink.ts";
import type { FlightOffer } from "./types.ts";

const base: FlightOffer = {
  id: "x",
  fingerprint: "f",
  origin: { code: "NAT", city: "Natal" },
  destination: { code: "GRU", city: "São Paulo" },
  departDate: "2026-11-15",
  returnDate: "2026-11-22",
  priceBRL: 219,
  airline: "LATAM",
  stops: 0,
  source: "mock",
  foundAt: "2026-10-07T12:00:00.000Z",
  deepLink: undefined,
  promoScore: 1,
};

test("monta deep link quando falta", () => {
  const withLink = ensureDeepLink(base);
  assert.match(withLink.deepLink, /google\.com\/travel\/flights/);
  assert.match(withLink.deepLink, /NAT/);
  assert.match(withLink.deepLink, /GRU/);
});

test("DM do adm inclui link", () => {
  const url = buildGoogleFlightsUrl(base);
  const text = formatAdminDm({ ...base, deepLink: url });
  assert.match(text, /Google Flights/);
  assert.match(text, /NAT → GRU/);
  assert.ok(text.includes(url));
});
