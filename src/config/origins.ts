export type OriginAirport = {
  code: string;
  city: string;
  label: string;
};

/** Default departure airports, in run order (pairs share a city/region). */
export const ORIGIN_AIRPORTS: readonly OriginAirport[] = [
  { code: "GRU", city: "São Paulo", label: "São Paulo (Guarulhos)" },
  { code: "CGH", city: "São Paulo", label: "São Paulo (Congonhas)" },
  { code: "GIG", city: "Rio de Janeiro", label: "Rio de Janeiro (Galeão)" },
  { code: "SDU", city: "Rio de Janeiro", label: "Rio de Janeiro (Santos Dumont)" },
  { code: "REC", city: "Recife", label: "Recife" },
  { code: "NAT", city: "Natal", label: "Natal" },
  { code: "JPA", city: "João Pessoa", label: "João Pessoa" },
  { code: "SLZ", city: "São Luís", label: "São Luís" },
];

export const DEFAULT_ORIGIN_CODES: readonly string[] = ORIGIN_AIRPORTS.map((item) => item.code);

const byCode = new Map(ORIGIN_AIRPORTS.map((item) => [item.code, item]));

export function originByCode(code: string): OriginAirport {
  return byCode.get(code.toUpperCase()) ?? {
    code: code.toUpperCase(),
    city: code.toUpperCase(),
    label: code.toUpperCase(),
  };
}
