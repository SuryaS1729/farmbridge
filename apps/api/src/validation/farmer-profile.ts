import { z } from "zod";

const acresPattern = /^\d{1,6}(?:\.\d{1,2})?$/;

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(2, `Enter the ${label}.`)
    .max(max, `The ${label} must be ${max} characters or fewer.`);
}

export const saveFarmerProfileSchema = z
  .object({
    aadhaarName: requiredText("name as on Aadhaar", 100),
    village: requiredText("village name", 80),
    mandal: requiredText("mandal name", 80),
    farmSizeAcres: z
      .string()
      .trim()
      .regex(acresPattern, "Enter the farm size in acres, up to two decimal places.")
      .refine((value) => Number(value) > 0, "Farm size must be more than zero."),
    cocoaTreeCount: z
      .number()
      .int("Enter a whole number of trees.")
      .positive("Tree count must be more than zero.")
      .max(10_000_000, "Check the number of trees."),
  })
  .strict();

export type SaveFarmerProfileInput = z.infer<typeof saveFarmerProfileSchema>;
