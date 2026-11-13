import { useMutation } from "convex/react";
import { useState } from "react";

import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/group/card";
import { Dropdown } from "@/components/ui/dropdown";
import { errorText } from "@/lib/error-text";
import { JOIN_ROLES, ROLE_NAMES, type JoinRole } from "@/lib/roles";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const EXPLAINED: Record<JoinRole, string> = {
  member: "People who join with the code start as Members. Give them a Role from the list above.",
  playbackManager: "People who join with the code, Guests included, start as Playback Managers and can Start, Jump and Stop.",
  songManager: "People who join with the code, Guests included, start as Song Managers and can edit Songs and Setlists.",
};

export function JoinRoleCard({ groupId, joinRole }: { groupId: Id<"groups">; joinRole: JoinRole }) {
  const setJoinRole = useMutation(api.groups.setJoinRole);
  const [pending, setPending] = useState<JoinRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = pending ?? joinRole;
  const choose = (next: JoinRole) => {
    if (next === shown || pending !== null) return;
    setError(null);
    setPending(next);
    setJoinRole({ groupId, joinRole: next })
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setPending(null));
  };
  return (
    <Card title="New Members join as">
      <Dropdown
        label="New Members join as"
        testID="join-role"
        options={JOIN_ROLES.map((role) => ({ value: role, label: ROLE_NAMES[role] }))}
        value={shown}
        onChange={choose}
        disabled={pending !== null}
      />
      <ThemedText type="caption" themeColor="textSecondary" testID="join-role-explained">
        {EXPLAINED[shown]}
      </ThemedText>
      {error ? (
        <ThemedText type="caption" themeColor="danger" testID="join-role-error">
          {error}
        </ThemedText>
      ) : null}
    </Card>
  );
}
