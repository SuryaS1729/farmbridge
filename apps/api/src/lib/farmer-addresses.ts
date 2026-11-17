import { and, count, desc, eq } from "drizzle-orm";

import type { createDb } from "../db/client";
import { farmerAddresses, farmerProfile } from "../db/schema";
import {
  MAX_ADDRESSES_PER_FARMER,
  type SaveAddressInput,
} from "../validation/farmer-address";

type Database = ReturnType<typeof createDb>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const addressColumns = {
  id: farmerAddresses.id,
  label: farmerAddresses.label,
  address: farmerAddresses.address,
  isDefault: farmerAddresses.isDefault,
  createdAt: farmerAddresses.createdAt,
};

/** Returns the farmer's profile id, creating an empty profile if needed. */
export async function ensureFarmerProfileId(tx: Transaction, authUserId: string) {
  await tx
    .insert(farmerProfile)
    .values({ authUserId })
    .onConflictDoNothing({ target: farmerProfile.authUserId });

  const [profile] = await tx
    .select({ id: farmerProfile.id })
    .from(farmerProfile)
    .where(eq(farmerProfile.authUserId, authUserId))
    .limit(1);

  if (!profile) {
    throw new Error("Farmer profile could not be created.");
  }
  return profile.id;
}

/**
 * Saves a new address. The first address always becomes the default.
 * Returns null when the farmer already has the maximum number of addresses.
 */
export async function createFarmerAddress(
  tx: Transaction,
  farmerId: string,
  input: SaveAddressInput & { isDefault?: boolean },
) {
  const [{ total }] = await tx
    .select({ total: count() })
    .from(farmerAddresses)
    .where(eq(farmerAddresses.farmerId, farmerId));

  if (total >= MAX_ADDRESSES_PER_FARMER) {
    return null;
  }

  const makeDefault = total === 0 || input.isDefault === true;
  if (makeDefault) {
    await tx
      .update(farmerAddresses)
      .set({ isDefault: false })
      .where(and(eq(farmerAddresses.farmerId, farmerId), eq(farmerAddresses.isDefault, true)));
  }

  const [created] = await tx
    .insert(farmerAddresses)
    .values({
      farmerId,
      label: input.label,
      address: input.address,
      isDefault: makeDefault,
    })
    .returning(addressColumns);

  return created;
}

/** After deleting the default address, promote the newest remaining one. */
export async function promoteNewestAddress(tx: Transaction, farmerId: string) {
  const [newest] = await tx
    .select({ id: farmerAddresses.id })
    .from(farmerAddresses)
    .where(eq(farmerAddresses.farmerId, farmerId))
    .orderBy(desc(farmerAddresses.createdAt))
    .limit(1);

  if (newest) {
    await tx
      .update(farmerAddresses)
      .set({ isDefault: true })
      .where(eq(farmerAddresses.id, newest.id));
  }
}
