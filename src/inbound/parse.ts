import { addDays, dayKey } from "../lib/clock.ts";
import { normalizeCityKey, resolveCity, type CityAirports } from "../geo/cities.ts";

export type DateScope =
  | { kind: "day"; date: string }
  | { kind: "week"; from: string; to: string };

export type ParsedSearch =
  | {
      ok: true;
      origin: CityAirports;
      destination: CityAirports;
      scope: DateScope;
    }
  | {
      ok: false;
      reason: "not-search" | "need-clarify";
      missing: Array<"origin" | "destination" | "date">;
      message?: string;
    };

/** True when message starts with "bot" (optional comma/punctuation). */
export function startsWithBotCommand(text: string): boolean {
  return /^bot\b/i.test(text.trim());
}

/** DM filter: starts with "bot" OR (voo/passagem + route cues). Groups use startsWithBotCommand only. */
export function isInboundSearchRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (startsWithBotCommand(t)) return true;
  const hasFlight = /\b(voo|voos|passagem|passagens|aereo|aéreo)\b/.test(t);
  const hasRoute =
    /\bsaindo de\b/.test(t) ||
    /\bde\b.+\b(pra|para|pro)\b/.test(t) ||
    /\b(pra|para|pro)\b/.test(t);
  return hasFlight && hasRoute;
}

export function parseInboundSearch(text: string, now = new Date(), timeZone = "America/Sao_Paulo"): ParsedSearch {
  if (!isInboundSearchRequest(text)) {
    return { ok: false, reason: "not-search", missing: [] };
  }

  const cleaned = text
    .trim()
    .replace(/^bot\b[,:\s-]*/i, "")
    .replace(/\s+/g, " ");

  const originRaw = matchOrigin(cleaned);
  const destRaw = matchDestination(cleaned);
  const scope = matchDateScope(cleaned, now, timeZone);

  const origin = originRaw ? resolveCity(originRaw) : undefined;
  const destination = destRaw ? resolveCity(destRaw) : undefined;

  const missing: Array<"origin" | "destination" | "date"> = [];
  if (!origin) missing.push("origin");
  if (!destination) missing.push("destination");
  if (!scope) missing.push("date");

  if (missing.length) {
    return {
      ok: false,
      reason: "need-clarify",
      missing,
      message: clarifyMessage(missing),
    };
  }

  return {
    ok: true,
    origin: origin!,
    destination: destination!,
    scope: scope!,
  };
}

function matchOrigin(text: string): string | undefined {
  const patterns = [
    /\bsaindo de\s+(.+?)(?=\s+(?:pra|para|pro|no dia|na semana|em\b|,|\.|$))/i,
    /\bde\s+(.+?)(?=\s+(?:pra|para|pro)\b)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return trimCityChunk(m[1]);
  }
  return undefined;
}

function matchDestination(text: string): string | undefined {
  const patterns = [
    /\b(?:pra|para|pro)\s+(.+?)(?=\s+(?:no dia|na semana|em\b|dia\b|,|\.|$))/i,
    /\b(?:pra|para|pro)\s+(.+)$/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return trimCityChunk(m[1]);
  }
  return undefined;
}

function trimCityChunk(value: string): string {
  return value
    .replace(/\b(mais barato|barato|voo|voos|passagem|passagens|qual|o|a|um|uma)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchDateScope(
  text: string,
  now: Date,
  timeZone: string,
): DateScope | undefined {
  const week = text.match(/\bna semana(?:\s+do dia|\s+de)?\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (week?.[1]) {
    const from = parseBrDate(week[1], now, timeZone);
    if (!from) return undefined;
    return { kind: "week", from, to: addDays(from, 6) };
  }

  const day =
    text.match(/\bno dia\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i) ??
    text.match(/\bdia\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i) ??
    text.match(/\bem\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (day?.[1]) {
    const date = parseBrDate(day[1], now, timeZone);
    if (!date) return undefined;
    return { kind: "day", date };
  }

  return undefined;
}

/** Accepts D/M, DD/MM, DD/MM/YY, DD/MM/YYYY. Defaults year to current (or next if already past). */
export function parseBrDate(raw: string, now: Date, timeZone: string): string | undefined {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return undefined;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return undefined;

  const today = dayKey(now, timeZone);
  const currentYear = Number(today.slice(0, 4));
  let year = currentYear;
  if (m[3]) {
    year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  } else {
    const candidate = `${currentYear}-${pad(mm)}-${pad(dd)}`;
    if (candidate < today) year = currentYear + 1;
  }

  return `${year}-${pad(mm)}-${pad(dd)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function clarifyMessage(missing: Array<"origin" | "destination" | "date">): string {
  const bits: string[] = [];
  if (missing.includes("origin")) bits.push("cidade de saída");
  if (missing.includes("destination")) bits.push("destino");
  if (missing.includes("date")) bits.push("um dia (ex.: no dia 15/11) ou a semana (ex.: na semana do dia 10/11)");
  return `Não peguei ${bits.join(" + ")}. Me manda tipo: bot, voo mais barato saindo de Natal pra São Paulo no dia 15/11`;
}

export function debugNormalize(value: string): string {
  return normalizeCityKey(value);
}
