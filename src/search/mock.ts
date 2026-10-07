import { addDays, dayKey } from "../lib/clock.ts";
import type { RawFare } from "../offers/types.ts";
import type { FlightSearchAdapter, SearchQuery } from "./adapter.ts";

type CatalogRow = {
  code: string;
  city: string;
  base: number;
  international?: boolean;
};

const CATALOG: readonly CatalogRow[] = [
  { code: "SSA", city: "Salvador", base: 318 },
  { code: "FOR", city: "Fortaleza", base: 356 },
  { code: "NAT", city: "Natal", base: 389 },
  { code: "MCZ", city: "Maceió", base: 342 },
  { code: "REC", city: "Recife", base: 329 },
  { code: "MAO", city: "Manaus", base: 612 },
  { code: "BEL", city: "Belém", base: 548 },
  { code: "IGU", city: "Foz do Iguaçu", base: 412 },
  { code: "FLN", city: "Florianópolis", base: 298 },
  { code: "CWB", city: "Curitiba", base: 276 },
  { code: "POA", city: "Porto Alegre", base: 334 },
  { code: "BSB", city: "Brasília", base: 289 },
  { code: "GRU", city: "São Paulo", base: 310 },
  { code: "CGH", city: "São Paulo", base: 295 },
  { code: "GIG", city: "Rio de Janeiro", base: 320 },
  { code: "SDU", city: "Rio de Janeiro", base: 280 },
  { code: "VCP", city: "Campinas", base: 305 },
  { code: "CNF", city: "Belo Horizonte", base: 340 },
  { code: "EZE", city: "Buenos Aires", base: 890, international: true },
  { code: "SCL", city: "Santiago", base: 1120, international: true },
  { code: "LIS", city: "Lisboa", base: 1840, international: true },
  { code: "MIA", city: "Miami", base: 1680, international: true },
];

const AIRLINES = ["LATAM", "Gol", "Azul"] as const;

export class MockSearchAdapter implements FlightSearchAdapter {
  readonly source = "mock" as const;

  constructor(private readonly timezone: string) {}

  async search(query: SearchQuery): Promise<RawFare[]> {
    const today = dayKey(new Date(), this.timezone);
    const seed = seedFrom(`${today}|${query.originCode}|${(query.destinationCodes ?? []).join(",")}`);

    if (query.destinationCodes?.length) {
      const days = departDaysInWindow(query.departFrom, query.departTo, today);
      const fares: RawFare[] = [];
      let index = 0;
      for (const destCode of query.destinationCodes) {
        const row = catalogByCode(destCode) ?? {
          code: destCode,
          city: query.destinationCity ?? destCode,
          base: 360,
        };
        for (const departDate of days) {
          fares.push(buildFare(query, row, seed, index, departDate));
          index += 1;
        }
      }
      return fares;
    }

    const picks = pickRows(query.originCode, seed, 5);
    return picks.map((row, index) => {
      const departOffset = 18 + (seed + index * 7) % 28;
      const departDate =
        query.departFrom && query.departFrom === query.departTo
          ? query.departFrom
          : query.departFrom && query.departTo
            ? clampDay(addDays(today, departOffset), query.departFrom, query.departTo)
            : addDays(today, departOffset);
      return buildFare(query, row, seed, index, departDate);
    });
  }
}

function buildFare(
  query: SearchQuery,
  row: CatalogRow,
  seed: number,
  index: number,
  departDate: string,
): RawFare {
  const stay = 4 + ((seed + index) % 5);
  const jitter = ((seed + index * 13) % 9) - 4;
  const promoCut = index % 3 === 0 ? 0.78 : index % 3 === 1 ? 0.86 : 0.97;
  // small per-airport bias so CGH vs GRU differ
  const codeBias = (row.code.charCodeAt(0) + row.code.charCodeAt(2)) % 7;
  const price = Math.max(
    219,
    Math.round((row.base * promoCut + jitter * 8 - codeBias * 3) / 10) * 10,
  );
  const outbound = mockLegTimes(seed + index * 3, 6, 11);
  const returnLeg = mockLegTimes(seed + index * 5 + 11, 16, 21);
  return {
    originCode: query.originCode,
    originCity: query.originCity,
    destinationCode: row.code,
    destinationCity: row.city,
    departDate,
    returnDate: addDays(departDate, stay),
    priceBRL: price,
    airline: AIRLINES[(seed + index) % AIRLINES.length] ?? "LATAM",
    stops: index % 4 === 2 ? 1 : 0,
    deepLink: `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=flights%20${query.originCode}%20to%20${row.code}`,
    outbound,
    returnLeg,
  };
}

function departDaysInWindow(
  from: string | undefined,
  to: string | undefined,
  today: string,
): string[] {
  if (from && to) {
    const days: string[] = [];
    let cursor = from;
    for (let i = 0; i < 14; i += 1) {
      days.push(cursor);
      if (cursor >= to) break;
      cursor = addDays(cursor, 1);
    }
    return days.length ? days : [from];
  }
  if (from) return [from];
  return [addDays(today, 21)];
}

function clampDay(day: string, from: string, to: string): string {
  if (day < from) return from;
  if (day > to) return to;
  return day;
}

function catalogByCode(code: string): CatalogRow | undefined {
  return CATALOG.find((row) => row.code === code.toUpperCase());
}

function seedFrom(value: string): number {
  let acc = 0;
  for (const char of value) acc = (acc * 33 + char.charCodeAt(0)) >>> 0;
  return acc;
}

function pickRows(originCode: string, seed: number, count: number): CatalogRow[] {
  const pool = CATALOG.filter((row) => row.code !== originCode);
  const chosen: CatalogRow[] = [];
  let cursor = seed;
  while (chosen.length < count && chosen.length < pool.length) {
    const index = cursor % pool.length;
    const row = pool[index];
    if (row && !chosen.includes(row)) chosen.push(row);
    cursor = (cursor * 17 + 31) >>> 0;
  }
  return chosen;
}

function mockLegTimes(
  seed: number,
  earliestHour: number,
  latestHour: number,
): {
  departTime: string;
  arriveTime: string;
} {
  const span = Math.max(1, latestHour - earliestHour);
  const departHour = earliestHour + (seed % span);
  const departMin = [0, 10, 20, 30, 40, 50][seed % 6] ?? 0;
  const durationMin = 55 + (seed % 5) * 10;
  const departTotal = departHour * 60 + departMin;
  const arriveTotal = departTotal + durationMin;
  return {
    departTime: formatHm(departTotal),
    arriveTime: formatHm(arriveTotal),
  };
}

function formatHm(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
