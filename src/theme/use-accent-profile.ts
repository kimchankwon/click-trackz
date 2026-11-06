import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { errorText } from "@/lib/error-text";
import { deviceStore } from "@/settings/device-store";
import { api } from "../../convex/_generated/api";
import { isAccentId, type AccentId } from "./accents";
import { ACCENT_KEY, setAccent } from "./accent-store";

export function useAccentSync() {
  const viewer = useQuery(api.users.viewer, {});
  const profileAccent = viewer?.accent ?? null;
  const profileApplied = useRef(false);

  useEffect(() => {
    let cancelled = false;
    deviceStore.get(ACCENT_KEY).then(
      (stored) => {
        if (!cancelled && !profileApplied.current && stored !== null && isAccentId(stored)) setAccent(stored);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (profileAccent === null) return;
    profileApplied.current = true;
    setAccent(profileAccent);
    deviceStore.set(ACCENT_KEY, profileAccent).catch(() => undefined);
  }, [profileAccent]);
}

export function useChooseAccent() {
  const viewer = useQuery(api.users.viewer, {});
  const save = useMutation(api.users.setAccent);
  const [saveError, setSaveError] = useState<string | null>(null);
  const signedIn = viewer !== undefined && viewer !== null && !viewer.isAnonymous;

  const choose = useCallback(
    (next: AccentId) => {
      setSaveError(null);
      setAccent(next);
      deviceStore.set(ACCENT_KEY, next).catch(() => undefined);
      if (signedIn) save({ accent: next }).catch((error: unknown) => setSaveError(errorText(error)));
    },
    [signedIn, save],
  );

  return { choose, signedIn, saveError };
}
