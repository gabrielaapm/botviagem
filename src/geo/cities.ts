export type CityAirports = {
  city: string;
  codes: string[];
};

/** Normalized key (no accents, lower) → airports. Multiple codes = pick cheapest later. */
const CITIES: { aliases: string[]; city: string; codes: string[] }[] = [
  { aliases: ["sao paulo", "sampa", "sp"], city: "São Paulo", codes: ["CGH", "GRU"] },
  { aliases: ["guarulhos"], city: "São Paulo", codes: ["GRU"] },
  { aliases: ["congonhas"], city: "São Paulo", codes: ["CGH"] },
  { aliases: ["rio de janeiro", "rio", "rj"], city: "Rio de Janeiro", codes: ["GIG", "SDU"] },
  { aliases: ["galeao"], city: "Rio de Janeiro", codes: ["GIG"] },
  { aliases: ["santos dumont"], city: "Rio de Janeiro", codes: ["SDU"] },
  { aliases: ["natal", "nat"], city: "Natal", codes: ["NAT"] },
  { aliases: ["recife", "rec"], city: "Recife", codes: ["REC"] },
  { aliases: ["joao pessoa", "jpa"], city: "João Pessoa", codes: ["JPA"] },
  { aliases: ["sao luis", "slz"], city: "São Luís", codes: ["SLZ"] },
  { aliases: ["salvador", "ssa", "bahia"], city: "Salvador", codes: ["SSA"] },
  { aliases: ["fortaleza", "for"], city: "Fortaleza", codes: ["FOR"] },
  { aliases: ["maceio", "mcz"], city: "Maceió", codes: ["MCZ"] },
  { aliases: ["brasilia", "bsb"], city: "Brasília", codes: ["BSB"] },
  { aliases: ["curitiba", "cwb"], city: "Curitiba", codes: ["CWB"] },
  { aliases: ["florianopolis", "floripa", "fln"], city: "Florianópolis", codes: ["FLN"] },
  { aliases: ["porto alegre", "poa"], city: "Porto Alegre", codes: ["POA"] },
  { aliases: ["campinas", "viracopos", "vcp"], city: "Campinas", codes: ["VCP"] },
  { aliases: ["belo horizonte", "bh", "confins", "cnf"], city: "Belo Horizonte", codes: ["CNF"] },
  { aliases: ["manaus", "mao"], city: "Manaus", codes: ["MAO"] },
  { aliases: ["belem", "bel"], city: "Belém", codes: ["BEL"] },
  { aliases: ["foz do iguacu", "foz", "igu"], city: "Foz do Iguaçu", codes: ["IGU"] },
];

export function normalizeCityKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCity(raw: string): CityAirports | undefined {
  const key = normalizeCityKey(raw);
  if (!key) return undefined;

  // Prefer longer aliases first so "sao paulo" wins over "sp" noise.
  const ranked = CITIES.flatMap((row) =>
    row.aliases.map((alias) => ({ alias, row, len: alias.length })),
  ).sort((a, b) => b.len - a.len);

  for (const { alias, row } of ranked) {
    if (key === alias) return { city: row.city, codes: [...row.codes] };
    // multi-word alias contained as whole phrase
    if (alias.includes(" ") && (key.includes(alias) || alias.includes(key))) {
      if (key.includes(alias)) return { city: row.city, codes: [...row.codes] };
    }
  }

  // short exact IATA
  if (/^[a-z]{3}$/i.test(key)) {
    const code = key.toUpperCase();
    const known = CITIES.find((row) => row.codes.includes(code));
    return { city: known?.city ?? code, codes: [code] };
  }

  // final pass: single-token alias exact only (already covered) — try token equality
  const tokens = key.split(" ");
  for (const { alias, row } of ranked) {
    if (!alias.includes(" ") && tokens.includes(alias)) {
      return { city: row.city, codes: [...row.codes] };
    }
  }

  return undefined;
}
