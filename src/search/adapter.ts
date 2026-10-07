import type { OfferSource, RawFare } from "../offers/types.ts";

export type SearchQuery = {
  originCode: string;
  originCity: string;
  currency: "BRL";
  /** Optional destination filter (IATA). When set, adapters should prefer these. */
  destinationCodes?: string[];
  destinationCity?: string;
  /** Inclusive depart window YYYY-MM-DD (day or week). */
  departFrom?: string;
  departTo?: string;
};

export interface FlightSearchAdapter {
  readonly source: OfferSource;
  search(query: SearchQuery): Promise<RawFare[]>;
}
