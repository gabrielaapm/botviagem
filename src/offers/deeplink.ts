import type { FlightOffer } from "./types.ts";

/** Build a Google Flights search URL when the offer has no deepLink. */
export function buildGoogleFlightsUrl(offer: {
  origin: { code: string };
  destination: { code: string };
  departDate: string;
  returnDate: string;
}): string {
  const q = `${offer.origin.code} to ${offer.destination.code} ${offer.departDate} ${offer.returnDate}`;
  const params = new URLSearchParams({
    hl: "pt-BR",
    curr: "BRL",
    q,
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

export function ensureDeepLink<T extends { deepLink: string | undefined } & Parameters<typeof buildGoogleFlightsUrl>[0]>(
  offer: T,
): T & { deepLink: string } {
  if (offer.deepLink && offer.deepLink.trim()) {
    return { ...offer, deepLink: offer.deepLink.trim() };
  }
  return { ...offer, deepLink: buildGoogleFlightsUrl(offer) };
}

export function formatAdminDm(offer: FlightOffer & { deepLink: string }): string {
  const route = `${offer.origin.code} → ${offer.destination.code}`;
  const dates = `${fmt(offer.departDate)} → ${fmt(offer.returnDate)}`;
  const price = `R$ ${Math.round(offer.priceBRL)}`;
  const stops = offer.stops === 0 ? "Direto" : `${offer.stops} parada(s)`;
  const airline = offer.airline ? ` · ${offer.airline}` : "";
  return [
    "🔗 Oferta aprovada — link Google Flights",
    "",
    `${offer.destination.city.toUpperCase()} | ${price}`,
    `${route} · ${dates}`,
    `${stops}${airline}`,
    "",
    "Abrir no Google Flights:",
    offer.deepLink,
  ].join("\n");
}

function fmt(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${Number(d)}/${Number(m)}`;
}
