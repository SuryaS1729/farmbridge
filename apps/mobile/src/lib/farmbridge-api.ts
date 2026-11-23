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
} & (
  | { pickupAddressId: string; newPickupAddress?: never }
  | { newPickupAddress: AddressInput; pickupAddressId?: never }
);

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
  offerPickupLocation: string | null;
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

async function request<T>(path: string, options: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }) {
  const result = await authClient.$fetch<T>(`${API_BASE_URL}${path}`, {
    method: options.method,
    body: options.body,
  });

  if (result.error) {
    // Our API sends `{ error: "..." }`; Better Auth's own errors use `message`.
    const apiError = result.error as { error?: string; message?: string };
    throw new Error(apiError.error || apiError.message || "The request could not be completed.");
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

/** Changes an open quote. It goes back to "pending" and keeps its end-of-day expiry. */
export function reviseQuote(offerId: string, input: QuoteInput) {
  return request<{ offer: SubmittedOffer }>(`/api/offers/${offerId}/revise`, {
    method: "POST",
    body: input,
  });
}

/** Still waiting on the buying team and not past its end-of-day expiry, so it can be revised. */
export function isOpenQuote(quote: FarmerOffer) {
  return (
    (quote.status === "pending" || quote.status === "invalid_needs_revision") &&
    new Date(quote.expiresAt).getTime() > Date.now()
  );
}

/** A farmer can have only one open quote at a time (the API enforces it). */
export function findOpenQuote(quotes: FarmerOffer[] | undefined) {
  return quotes?.find(isOpenQuote) ?? null;
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

export type FarmerProfileInput = {
  aadhaarName: string;
  village: string;
  mandal: string;
  farmSizeAcres: string;
  cocoaTreeCount: number;
};

export type FarmerProfile = {
  aadhaarName: string | null;
  village: string | null;
  mandal: string | null;
  farmSizeAcres: string | null;
  cocoaTreeCount: number | null;
  onboardedAt: string | null;
};

export type FarmerProfileResponse = {
  profile: FarmerProfile | null;
  onboarded: boolean;
};

export function getFarmerProfile() {
  return request<FarmerProfileResponse>("/api/farmer/profile", {
    method: "GET",
  });
}

export function saveFarmerProfile(input: FarmerProfileInput) {
  return request<FarmerProfileResponse>("/api/farmer/profile", {
    method: "POST",
    body: input,
  });
}

export type AddressInput = {
  label: string;
  address: string;
};

export type FarmerAddress = AddressInput & {
  id: string;
  isDefault: boolean;
  createdAt: string;
};

export function getAddresses() {
  return request<{ addresses: FarmerAddress[] }>("/api/farmer/addresses", {
    method: "GET",
  });
}

export function createAddress(input: AddressInput & { isDefault?: boolean }) {
  return request<{ address: FarmerAddress }>("/api/farmer/addresses", {
    method: "POST",
    body: input,
  });
}

export function updateAddress(id: string, input: AddressInput) {
  return request<{ address: FarmerAddress }>(`/api/farmer/addresses/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function setDefaultAddress(id: string) {
  return request<{ id: string }>(`/api/farmer/addresses/${id}/default`, {
    method: "POST",
  });
}

export function deleteAddress(id: string) {
  return request<{ id: string }>(`/api/farmer/addresses/${id}`, {
    method: "DELETE",
  });
}
