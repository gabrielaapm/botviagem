import { fareFingerprint, offerId } from "../offers/fingerprint.ts";
import { formatOfferMessage } from "../offers/template.ts";
import type { FlightOffer, RawFare } from "../offers/types.ts";
import type { FlightSearchAdapter } from "../search/adapter.ts";
import { log } from "../lib/log.ts";
import { isInboundSearchRequest, parseInboundSearch, type DateScope } from "./parse.ts";

export type InboundReply = {
  jid: string;
  text: string;
};

/**
 * Handle one private-chat text. Returns a reply to send, or undefined to stay silent.
 * Groups must be filtered before calling.
 */
export async function handleInboundSearchText(opts: {
  text: string;
  search: FlightSearchAdapter;
  timeZone: string;
  brandName: string;
}): Promise<string | undefined> {
  if (!isInboundSearchRequest(opts.text)) return undefined;

  const parsed = parseInboundSearch(opts.text, new Date(), opts.timeZone);
  if (!parsed.ok) {
    if (parsed.reason === "need-clarify") return parsed.message;
    return undefined;
  }

  const { origin, destination, scope } = parsed;
  const { departFrom, departTo } = scopeToWindow(scope);

  const candidates: RawFare[] = [];
  for (const originCode of origin.codes) {
    try {
      const fares = await opts.search.search({
        originCode,
        originCity: origin.city,
        currency: "BRL",
        destinationCodes: destination.codes,
        destinationCity: destination.city,
        departFrom,
        departTo,
      });
      candidates.push(...fares);
    } catch (err) {
      log.warn(`busca inbound falhou em ${originCode}`, err);
    }
  }

  const inWindow = candidates.filter((fare) => fare.departDate >= departFrom && fare.departDate <= departTo);
  const pool = inWindow.length ? inWindow : candidates;
  if (!pool.length) {
    return `Não achei passagem de ${origin.city} pra ${destination.city} nesse período. Tenta outra data?`;
  }

  pool.sort((a, b) => a.priceBRL - b.priceBRL);
  const best = pool[0];
  if (!best) {
    return `Não achei passagem de ${origin.city} pra ${destination.city} nesse período. Tenta outra data?`;
  }

  const offer = rawToOffer(best, opts.search.source);
  const header =
    scope.kind === "week"
      ? `Achei o mais barato na semana ${fmtBr(scope.from)}–${fmtBr(scope.to)}:`
      : `Achei o mais barato no dia ${fmtBr(scope.date)}:`;
  return `${header}\n\n${formatOfferMessage(offer, opts.brandName)}`;
}

function scopeToWindow(scope: DateScope): { departFrom: string; departTo: string } {
  if (scope.kind === "day") return { departFrom: scope.date, departTo: scope.date };
  return { departFrom: scope.from, departTo: scope.to };
}

function rawToOffer(fare: RawFare, source: FlightOffer["source"]): FlightOffer {
  const fingerprint = fareFingerprint(fare);
  const foundAt = new Date().toISOString();
  const offer: FlightOffer = {
    id: offerId(fingerprint, foundAt),
    fingerprint,
    origin: { code: fare.originCode, city: fare.originCity },
    destination: { code: fare.destinationCode, city: fare.destinationCity },
    departDate: fare.departDate,
    returnDate: fare.returnDate,
    priceBRL: fare.priceBRL,
    airline: fare.airline,
    stops: fare.stops,
    source,
    foundAt,
    deepLink: fare.deepLink,
    promoScore: 1,
  };
  if (fare.outbound) offer.outbound = fare.outbound;
  if (fare.returnLeg) offer.returnLeg = fare.returnLeg;
  return offer;
}

function fmtBr(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${Number(d)}/${Number(m)}`;
}
