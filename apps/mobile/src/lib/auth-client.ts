import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787",
  plugins: [
    expoClient({
      scheme: "farmer",
      storagePrefix: "farmbridge",
      storage: SecureStore,
    }),
    phoneNumberClient()
  ],
});
