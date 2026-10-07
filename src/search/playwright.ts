import { addDays, dayKey } from "../lib/clock.ts";
import { delay } from "../lib/delay.ts";
import { log } from "../lib/log.ts";
import type { RawFare } from "../offers/types.ts";
import type { FlightSearchAdapter, SearchQuery } from "./adapter.ts";

type PlaywrightModule = typeof import("playwright");

/**
 * Best-effort Google Flights explore scrape. Selectors change;
 * an empty result is a failed search, not a crash. Run this on
 * the agency PC, where a real browser session is less likely to
 * hit a datacenter CAPTCHA.
 */
export class PlaywrightSearchAdapter implements FlightSearchAdapter {
  readonly source = "playwright" as const;

  constructor(
    private readonly timezone: string,
    private readonly headless: boolean,
  ) {}

  async search(query: SearchQuery): Promise<RawFare[]> {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.launch({
      headless: this.headless,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    try {
      const context = await browser.newContext({
        locale: "pt-BR",
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        extraHTTPHeaders: { "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      const today = dayKey(new Date(), this.timezone);

      const depart = query.departFrom ?? addDays(today, 28);
      const back = query.departTo && query.departTo !== query.departFrom
        ? addDays(query.departFrom ?? depart, 7)
        : query.departFrom
          ? addDays(depart, 7)
          : addDays(today, 35);

      const destHint = query.destinationCodes?.[0];
      const url = destHint
        ? `https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=BRL` +
          `&q=${encodeURIComponent(`Voos de ${query.originCode} para ${destHint} ${depart} ${back}`)}`
        : `https://www.google.com/travel/explore?hl=pt-BR&gl=BR&curr=BRL` +
          `&q=${encodeURIComponent(`Voos baratos de ${query.originCode}`)}`;

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await delay(2_500);
      await dismissConsent(page);
      await delay(5_000);
      try {
        await page.waitForLoadState("networkidle", { timeout: 15_000 });
      } catch {
        // fine
      }
      await delay(2_000);

      const blocked = await page.evaluate(() => {
        const doc = (globalThis as unknown as { document?: { body?: { innerText?: string } } }).document;
        const text = doc?.body?.innerText?.toLowerCase() ?? "";
        return (
          text.includes("unusual traffic") ||
          text.includes("não sou um robô") ||
          text.includes("not a robot") ||
          text.includes("captcha") ||
          text.includes("enable javascript")
        );
      });
      if (blocked) {
        log.warn(`playwright ${query.originCode}: Google parece ter bloqueado / CAPTCHA`);
        return [];
      }

      let extracted = await page.evaluate(readFareCards);
      log.info(`playwright ${query.originCode}: ${extracted.length} preços lidos`);

      if (extracted.length === 0 && !destHint) {
        const fallback =
          `https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=BRL` +
          `&q=${encodeURIComponent(`Voos de ${query.originCode} para qualquer lugar ${depart} ${back}`)}`;
        await page.goto(fallback, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await delay(6_000);
        await dismissConsent(page);
        await delay(3_000);
        extracted = await page.evaluate(readFareCards);
        log.info(`playwright ${query.originCode} (flights fallback): ${extracted.length} preços lidos`);
        return extracted.filter((row) => isRealCity(row.city)).map((row) => toFare(query, row, depart, back, fallback));
      }

      return extracted.filter((row) => isRealCity(row.city)).map((row) => toFare(query, row, depart, back, url));
    } finally {
      await browser.close();
    }
  }
}

function isRealCity(city: string): boolean {
  const c = city.trim().toLowerCase();
  if (c.length < 3 || c.length > 40) return false;
  if (/sem escalas|escala|filtrar|ordenar|bagagem|direto|mapa|preço|google|entrar/.test(c)) return false;
  if (/^\d/.test(c)) return false;
  return true;
}

function toFare(
  query: SearchQuery,
  row: { city: string; priceBRL: number },
  depart: string,
  back: string,
  baseUrl: string,
): RawFare {
  const destinationCode = slugCode(row.city);
  const deepLink =
    `https://www.google.com/travel/flights?hl=pt-BR&gl=BR&curr=BRL` +
    `&q=${encodeURIComponent(`Voos de ${query.originCode} para ${row.city} ${depart} ${back}`)}`;
  return {
    originCode: query.originCode,
    originCity: query.originCity,
    destinationCode,
    destinationCity: row.city,
    departDate: depart,
    returnDate: back,
    priceBRL: row.priceBRL,
    airline: undefined,
    stops: 0,
    deepLink: deepLink || baseUrl,
  };
}

async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "playwright não instalou direito. roda npm install e depois npx playwright install chromium",
    );
  }
}

async function dismissConsent(page: {
  getByRole: (role: "button", opts: { name: RegExp }) => { click: (opts: { timeout: number }) => Promise<void> };
  locator: (sel: string) => { first: () => { click: (opts: { timeout: number }) => Promise<void> } };
}): Promise<void> {
  const labels = [/aceitar tudo/i, /aceitar/i, /accept all/i, /accept/i, /concordo/i, /eu concordo/i];
  for (const name of labels) {
    try {
      await page.getByRole("button", { name }).click({ timeout: 1500 });
      return;
    } catch {
      // cookie banner missing, fine
    }
  }
  try {
    await page.locator('button:has-text("Aceitar tudo")').first().click({ timeout: 1500 });
  } catch {
    // ignore
  }
}

type BrowserDocument = {
  body: { innerText: string };
};

function readFareCards(): { city: string; priceBRL: number }[] {
  const text = (globalThis as unknown as { document: BrowserDocument }).document.body.innerText ?? "";
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: { city: string; priceBRL: number }[] = [];
  const skipCity = /^(de|para|ida|volta|filtrar|ordenar|melhor|mais barato|não-stop|direto|escalas|sem escalas|1 escala|2 escalas|bagagem|google|entrar|menu|mapa|preços|calendário|datas|passageiros|economia|executiva|primeira|classe|resultados|explorar)/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    // R$ 1.234 or R$1234 or R$ 1.234,00
    const match = line.match(/R\$\s*([\d.]+)(?:,\d{2})?/);
    if (!match?.[1]) continue;
    const price = Number(match[1].replace(/\./g, ""));
    if (!price || price < 150 || price > 12_000) continue;

    let city: string | undefined;
    for (let back = 1; back <= 3; back += 1) {
      const previous = lines[i - back] ?? "";
      if (
        previous.length >= 3 &&
        previous.length < 42 &&
        !/R\$/.test(previous) &&
        !/^\d/.test(previous) &&
        !skipCity.test(previous)
      ) {
        city = previous.replace(/\s+\d+.*/, "").trim();
        break;
      }
    }
    if (!city) continue;
    if (rows.some((row) => row.city === city && row.priceBRL === price)) continue;
    rows.push({ city, priceBRL: price });
  }
  return rows.slice(0, 10);
}

function slugCode(city: string): string {
  return city
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
}
