export type OfferSource = "mock" | "playwright" | "api";

export type OfferStatus =
  | "pending"
  | "rejected"
  | "posted"
  | "failed";

export type AirportRef = {
  code: string;
  city: string;
};

/** Optional flight clock times as HH:MM (local). Omit when unknown. */
export type FlightLegTimes = {
  departTime: string;
  arriveTime: string;
};

export type FlightOffer = {
  id: string;
  fingerprint: string;
  origin: AirportRef;
  destination: AirportRef;
  departDate: string;
  returnDate: string;
  priceBRL: number;
  airline: string | undefined;
  stops: number;
  source: OfferSource;
  foundAt: string;
  deepLink: string | undefined;
  promoScore: number;
  outbound?: FlightLegTimes;
  returnLeg?: FlightLegTimes;
};

export type StoredOffer = FlightOffer & {
  status: OfferStatus;
  queuedAt: string;
  decidedAt: string | undefined;
  postedAt: string | undefined;
  error: string | undefined;
};

export type RawFare = {
  originCode: string;
  originCity: string;
  destinationCode: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
  priceBRL: number;
  airline: string | undefined;
  stops: number;
  deepLink: string | undefined;
  outbound?: FlightLegTimes;
  returnLeg?: FlightLegTimes;
};
