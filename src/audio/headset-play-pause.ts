import { requireOptionalNativeModule, type EventSubscription } from "expo";

type HeadsetPlayPauseModule = {
  setEnabled(enabled: boolean): void;
  addListener(eventName: "onTogglePlayPause", listener: () => void): EventSubscription;
};

const headsetModule = requireOptionalNativeModule<HeadsetPlayPauseModule>("HeadsetPlayPause");

export function setHeadsetPlayPause(enabled: boolean) {
  headsetModule?.setEnabled(enabled);
}

export function onHeadsetPlayPause(listener: () => void): () => void {
  const subscription = headsetModule?.addListener("onTogglePlayPause", listener);
  return () => subscription?.remove();
}
