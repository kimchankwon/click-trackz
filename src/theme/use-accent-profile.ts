import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";

import { errorText } from "@/lib/error-text";
import { deviceStore } from "@/settings/device-store";
import { api } from "../../convex/_generated/api";
import type { AccentId } from "./accents";
import { ACCENT_KEY, setAccent } from "./accent-store";

const DEVICE_SAVE_FAILED = "This device could not save your colour, so it will reset when you reopen the app.";

export function useAccentSync() {
  const viewer = useQuery(api.users.viewer, {});
  const profileAccent = viewer?.accent ?? null;

  useEffect(() => {
    if (profileAccent === null) return;
    setAccent(profileAccent);
    deviceStore.set(ACCENT_KEY, profileAccent).catch(() => undefined);
  }, [profileAccent]);
}

export function useChooseAccent() {
  const viewer = useQuery(api.users.viewer, {});
  const save = useMutation(api.users.setAccent);
  const [saveError, setSaveError] = useState<string | null>(null);
  const ready = viewer !== undefined;
  const signedIn = viewer !== undefined && viewer !== null && !viewer.isAnonymous;

  const choose = useCallback(
    (next: AccentId) => {
      if (!ready) return;
      setSaveError(null);
      setAccent(next);
      deviceStore.set(ACCENT_KEY, next).catch(() => {
        if (!signedIn) setSaveError(DEVICE_SAVE_FAILED);
      });
      if (signedIn) {
        save({ accent: next }).catch((error: unknown) =>
          setSaveError(`Your colour was not saved to your profile, so it may change back. ${errorText(error)}`),
        );
      }
    },
    [ready, signedIn, save],
  );

  return { choose, ready, signedIn, saveError };
}
