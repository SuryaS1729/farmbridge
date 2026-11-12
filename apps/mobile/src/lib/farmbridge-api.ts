import { authClient } from "@/lib/auth-client";

export type DailyCocoaPrice = {
  businessDate: string;
  basePricePerKg: string;
  basePricePerQuintal: string;
  currency: string;
};

export function formatPricePerKg(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export function formatDateForIndia(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

export type TodayPriceResponse = {
  businessDate: string;
  price: DailyCocoaPrice | null;
};

export type QuoteInput = {
  offeredPricePerKg: string;
  quantity: string;
  quantityUnit: "kg" | "quintal";
  moisturePercent: number;
  beanCountPer100g: number;
  readyOn: string;
};

export type SubmittedOffer = {
  id: string;
  status: string;
  expiresAt: string;
};

export type FarmerOffer = {
  id: string;
  offeredPricePerKg: string;
  quantityKg: string;
  quantityQuintals: string;
  moisturePercent: string;
  beanCountPer100g: string;
  readyOn: string;
  status:
    | "pending"
    | "invalid_needs_revision"
    | "accepted"
    | "rejected"
    | "withdrawn"
    | "expired";
  rejectionReason: string | null;
  submittedAt: string;
  expiresAt: string;
  dealId: string | null;
  dealStatus: "open" | "completed" | "cancelled" | null;
  acceptedAt: string | null;
  dealOfferedPricePerKg: string | null;
  dealQuantityQuintals: string | null;
  dealMoisturePercent: string | null;
  dealBeanCountPer100g: string | null;
  dealReadyOn: string | null;
  pickupLocation: string | null;
  pickupScheduledOn: string | null;
  collectedOn: string | null;
  collectedWeightKg: string | null;
  collectedWeightQuintals: string | null;
};

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787"
).replace(/\/$/, "");

async function request<T>(path: string, options: { method: "GET" | "POST"; body?: unknown }) {
  const result = await authClient.$fetch<T>(`${API_BASE_URL}${path}`, {
    method: options.method,
    body: options.body,
  });

  if (result.error) {
    throw new Error(result.error.message || "The request could not be completed.");
  }

  if (result.data === null || result.data === undefined) {
    throw new Error("Farmbridge returned an empty response.");
  }

  return result.data;
}

export function getTodayPrice() {
  return request<TodayPriceResponse>("/api/prices/today", { method: "GET" });
}

export function submitQuote(input: QuoteInput) {
  return request<{ offer: SubmittedOffer }>("/api/offers", {
    method: "POST",
    body: input,
  });
}

export function getMyQuotes() {
  return request<{ offers: FarmerOffer[] }>("/api/offers/mine", {
    method: "GET",
  });
}

export function savePickupLocation(dealId: string, pickupLocation: string) {
  return request<{ pickupLocation: string }>(`/api/deals/${dealId}/pickup-location`, {
    method: "POST",
    body: { pickupLocation },
  });
}
