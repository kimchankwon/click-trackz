import * as Device from "expo-device";
import { Platform } from "react-native";

import { trimDeviceLabel } from "@/lib/device-identity";

export function deviceLabel(): string {
  const model = Device.modelName;
  if (model) return trimDeviceLabel(model);
  return Platform.OS === "ios" ? "iPhone" : "Phone";
}
