import type { FlightOffer } from "./types.ts";

const BEACH_CODES = new Set([
  "SSA",
  "FOR",
  "NAT",
  "MCZ",
  "REC",
  "FLN",
  "MIA",
  "CUN",
  "PUJ",
]);

export function formatOfferMessage(offer: FlightOffer, _brandName?: string): string {
  const emoji = destinationEmoji(offer);
  const dest = offer.destination.city
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
  const price = `R$ ${Math.round(offer.priceBRL)}`;
  const dates = formatDateArrow(offer.departDate, offer.returnDate);
  const route = `${offer.origin.code} ⇄ ${offer.destination.city}`;
  const stops =
    offer.stops === 0 ? "⚡ Direto" : `⚡ ${offer.stops} parada${offer.stops === 1 ? "" : "s"}`;

  const lines = [
    `${emoji} ${dest} | ${price}`,
    "",
    `📅 ${dates}`,
    `✈️ ${route}`,
    stops,
  ];

  if (offer.outbound?.departTime && offer.outbound?.arriveTime) {
    lines.push(`🕐 ${offer.outbound.departTime} → ${offer.outbound.arriveTime}`);
  }
  if (offer.returnLeg?.departTime && offer.returnLeg?.arriveTime) {
    lines.push(`🕐 ${offer.returnLeg.departTime} → ${offer.returnLeg.arriveTime}`);
  }

  lines.push(
    "",
    "💬 Quer fechar? Me chama no PV.",
    "",
    "Valor sujeito a alteração até a emissão. Bagagem e assento conforme tarifa.",
  );

  return lines.join("\n");
}

export function formatBRL(value: number): string {
  return `R$ ${Math.round(value)}`;
}

function destinationEmoji(offer: FlightOffer): string {
  if (BEACH_CODES.has(offer.destination.code)) return "🌴";
  return "✈️";
}

/** Same month: 11 → 16/11. Cross month: 28/10 → 05/11. */
export function formatDateArrow(departDate: string, returnDate: string): string {
  const [dy, dm, dd] = departDate.split("-");
  const [ry, rm, rd] = returnDate.split("-");
  if (!dy || !dm || !dd || !ry || !rm || !rd) {
    return `${departDate} → ${returnDate}`;
  }
  const dDay = String(Number(dd));
  const rDay = String(Number(rd));
  const rMonth = String(Number(rm));
  const dMonth = String(Number(dm));
  if (dy === ry && dm === rm) {
    return `${dDay} → ${rDay}/${rMonth}`;
  }
  return `${dDay}/${dMonth} → ${rDay}/${rMonth}`;
}
