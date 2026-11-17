import { z } from "zod";

export const MAX_ADDRESSES_PER_FARMER = 10;

export const addressFields = {
  label: z
    .string()
    .trim()
    .min(1, "Give this address a short name, like Home.")
    .max(40, "Keep the address name to 40 characters or fewer."),
  address: z
    .string()
    .trim()
    .min(5, "Enter the address with a landmark, at least 5 characters.")
    .max(500, "Keep the address to 500 characters or fewer."),
};

export const saveAddressSchema = z.object(addressFields).strict();

export const createAddressSchema = z
  .object({ ...addressFields, isDefault: z.boolean().optional() })
  .strict();

export type SaveAddressInput = z.infer<typeof saveAddressSchema>;
