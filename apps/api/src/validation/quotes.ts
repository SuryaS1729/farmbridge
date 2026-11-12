import { z } from "zod";

const moneyPattern = /^\d{1,10}(?:\.\d{1,2})?$/;
const quintalsPattern = /^\d{1,7}(?:\.\d{1,2})?$/;
const kilogramsPattern = /^\d{1,9}(?:\.\d{1,3})?$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export const publishDailyPriceSchema = z
  .object({
    basePricePerQuintal: z.string().regex(moneyPattern, "Enter a price with up to two decimal places."),
  })
  .strict();

const sharedOfferFields = {
  offeredPricePerKg: z.string().regex(moneyPattern, "Enter a price with up to two decimal places."),
  moisturePercent: z.number().finite().min(0).max(100),
  beanCountPer100g: z.number().finite().positive(),
  readyOn: z
    .string()
    .regex(datePattern, "Enter a valid readiness date.")
    .refine(isCalendarDate, "Enter a valid readiness date."),
};

export const submitOfferSchema = z.discriminatedUnion("quantityUnit", [
  z
    .object({
      ...sharedOfferFields,
      quantityUnit: z.literal("kg"),
      quantity: z
        .string()
        .regex(kilogramsPattern, "Enter a kg quantity with up to three decimal places.")
        .refine((value) => Number(value) > 0, "Quantity must be greater than zero."),
    })
    .strict(),
  z
    .object({
      ...sharedOfferFields,
      quantityUnit: z.literal("quintal"),
      quantity: z
        .string()
        .regex(quintalsPattern, "Enter a quintal quantity with up to two decimal places.")
        .refine((value) => Number(value) > 0, "Quantity must be greater than zero."),
    })
    .strict(),
]);

const collectedOnField = z
  .string()
  .regex(datePattern, "Enter a valid collection date.")
  .refine(isCalendarDate, "Enter a valid collection date.");

export const recordCollectionSchema = z.discriminatedUnion("quantityUnit", [
  z
    .object({
      collectedOn: collectedOnField,
      quantityUnit: z.literal("kg"),
      quantity: z
        .string()
        .regex(kilogramsPattern, "Enter a kg weight with up to three decimal places.")
        .refine((value) => Number(value) > 0, "Weight must be greater than zero."),
    })
    .strict(),
  z
    .object({
      collectedOn: collectedOnField,
      quantityUnit: z.literal("quintal"),
      quantity: z
        .string()
        .regex(quintalsPattern, "Enter a quintal weight with up to two decimal places.")
        .refine((value) => Number(value) > 0, "Weight must be greater than zero."),
    })
    .strict(),
]);

export function decimalToCents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function decimalToTenThousandths(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
}

export function quintalPriceToKilogramPrice(value: string): string {
  const quintalCents = decimalToCents(value);
  const kilogramTenThousandths = quintalCents;
  const whole = kilogramTenThousandths / 10_000n;
  const fraction = (kilogramTenThousandths % 10_000n).toString().padStart(4, "0");
  return `${whole}.${fraction}`;
}

export function kilogramPriceToQuintalPrice(value: string): string {
  const kilogramTenThousandths = decimalToTenThousandths(value);
  const whole = kilogramTenThousandths / 100n;
  const fraction = (kilogramTenThousandths % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function quantityToKilograms(value: string, unit: "kg" | "quintal"): string {
  const [whole, fraction = ""] = value.split(".");
  const milliKilograms =
    unit === "kg"
      ? BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, "0"))
      : (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) * 1_000n;
  const kilograms = milliKilograms / 1_000n;
  const remainder = (milliKilograms % 1_000n).toString().padStart(3, "0");
  return `${kilograms}.${remainder}`;
}
