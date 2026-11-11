import { Platform } from "react-native";
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesError, type PurchasesPackage } from "react-native-purchases";

import { offersFrom, type PlanOffer } from "./offers";

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  web: process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY,
});

let identifiedAs: string | null = null;

export const purchasesAvailable = () => Boolean(apiKey);

export const canRestore = Platform.OS !== "web";

export async function identify(userId: string) {
  if (!apiKey) throw new Error("Subscriptions are not available in this build");
  if (identifiedAs === userId) return;
  if (identifiedAs === null) Purchases.configure({ apiKey, appUserID: userId });
  else await Purchases.logIn(userId);
  identifiedAs = userId;
}

export async function loadOffers(userId: string): Promise<PlanOffer<PurchasesPackage>[]> {
  await identify(userId);
  return offersFrom(await Purchases.getOfferings());
}

const cancelled = (error: unknown) => (error as Partial<PurchasesError> | null)?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;

export async function buy(userId: string, pkg: PurchasesPackage): Promise<"bought" | "cancelled"> {
  await identify(userId);
  try {
    await Purchases.purchasePackage(pkg);
    return "bought";
  } catch (error) {
    if (cancelled(error)) return "cancelled";
    throw error;
  }
}

export async function restore(userId: string) {
  await identify(userId);
  await Purchases.restorePurchases();
}

export async function managementUrl(userId: string) {
  await identify(userId);
  return (await Purchases.getCustomerInfo()).managementURL;
}
