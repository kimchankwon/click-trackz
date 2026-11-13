import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

import { deviceValue } from "@/lib/device-value";
import { parseHandoff } from "./parse-handoff";
import { api } from "../../convex/_generated/api";

const handoff = deviceValue("guest-handoff", parseHandoff);

export const saveGuestHandoff = (token: string) => handoff.save({ token });

export const forgetGuestHandoff = handoff.forget;

export function useClaimGuestHandoff(signedInWithGoogle: boolean) {
  const stored = handoff.useValue();
  const claim = useMutation(api.guestHandoff.claim);
  const claiming = useRef<string | null>(null);
  useEffect(() => {
    if (!signedInWithGoogle || !stored || claiming.current === stored.token) return;
    claiming.current = stored.token;
    claim({ token: stored.token })
      .then(() => handoff.forget())
      .catch(() => {
        claiming.current = null;
      });
  }, [signedInWithGoogle, stored, claim]);
}

export function useStartGuestHandoff() {
  const viewer = useQuery(api.users.viewer, {});
  const start = useMutation(api.guestHandoff.start);
  return async () => {
    if (viewer?.isAnonymous !== true) {
      await handoff.forget();
      return;
    }
    const token = await start({}).catch(() => null);
    if (token !== null) await saveGuestHandoff(token);
  };
}
