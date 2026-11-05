import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("EXPO_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to create .env.local.");
}

export const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false });

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export const authStorage = Platform.OS === "web" ? undefined : secureStorage;
