import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { phoneNumber } from "better-auth/plugins";
import type { createDb } from "./db/client";
import * as schema from "./db/schema";
import { expo } from "@better-auth/expo";

type AuthDatabase = ReturnType<typeof createDb>["db"];

export function createAuth(
  db: AuthDatabase,
  config: { secret: string; baseURL: string },
) {
  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [
      "farmer://",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema
    }),
    user: {
      additionalFields: {
        role: {
          type: ["farmer", "admin"],
          required: true,
          defaultValue: "farmer",
          input: false,
        },
      },
    },
    plugins: [
      phoneNumber({
        // Local development only: inspect the Wrangler terminal to get the OTP.
        // Replace this with the SMS provider before deploying.
        sendOTP: async ({ phoneNumber, code }) => {
          console.info(`[DEV OTP] ${phoneNumber}: ${code}`);
        },
        signUpOnVerification: {
          getTempEmail: (phone) =>
            `${phone.replace(/\D/g, "")}@phone.farmbridge.invalid`,
          getTempName: (phone) => phone,
        },
      }),
      expo()
    ],
  });
}
