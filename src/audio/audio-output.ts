import { requireOptionalNativeModule, type EventSubscription } from "expo";

export type AudioOutput = { id: string; name: string };

type OutputPort = { id?: string; name?: string };

type AudioOutputModule = {
  currentOutput?: () => OutputPort;
  addListener(eventName: "onOutputChange", listener: () => void): EventSubscription;
};

const outputModule = requireOptionalNativeModule<AudioOutputModule>("OutputLatency");

export function currentAudioOutput(): AudioOutput | null {
  try {
    const port = outputModule?.currentOutput?.();
    if (!port?.id) return null;
    return { id: port.id, name: port.name || port.id };
  } catch {
    return null;
  }
}

export function onAudioOutputChange(listener: () => void): () => void {
  if (outputModule === null || typeof outputModule.currentOutput !== "function") return () => undefined;
  const subscription = outputModule.addListener("onOutputChange", listener);
  return () => subscription.remove();
}
