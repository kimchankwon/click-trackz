import { browserLabel } from "@/lib/browser-label";
import { trimDeviceLabel } from "@/lib/device-identity";

export function deviceLabel(): string {
  return trimDeviceLabel(browserLabel(typeof navigator === "undefined" ? "" : navigator.userAgent));
}
