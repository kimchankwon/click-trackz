import { useAction, useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import { buy, canRestore, loadOffers, managementUrl, purchasesAvailable, restore } from "@/billing/purchases";
import type { PlanOffer } from "@/billing/offers";
import { ActionButton } from "@/components/action-button";
import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { PinnedHeader, PINNED_CONTENT_TOP, usePinnedHeader } from "@/components/ui/pinned-header";
import { ScreenHeader } from "@/components/ui/screen-header";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { errorText } from "@/lib/error-text";
import { LAUNCH_LIMITS, PLAN_NAMES, usageSummary, type PaidPlan } from "@/lib/plans";
import { api } from "../../convex/_generated/api";

const PLAN_PERKS: Record<PaidPlan, readonly string[]> = {
  plus: ["Create up to 3 Groups", "Up to 100 Songs across your Groups", "My Library holds 1000 Songs"],
  pro: ["Create as many Groups as you like", "No limit on Songs in your Groups", "My Library holds 1000 Songs"],
};

const BILLING_LABEL = { monthly: "a month", annual: "a year" } as const;


export default function SubscribeScreen() {
  const pinned = usePinnedHeader();
  const viewer = useQuery(api.users.viewer, {});
  const signedIn = viewer !== undefined && viewer !== null && !viewer.isAnonymous;
  const usage = useQuery(api.subscriptions.mine, signedIn ? {} : "skip");
  const refreshMine = useAction(api.subscriptions.refreshMine);
  const [offers, setOffers] = useState<PlanOffer<PurchasesPackage>[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const userId = signedIn ? viewer.id : null;
  const available = purchasesAvailable();

  useEffect(() => {
    if (userId === null || !available) return;
    let cancelled = false;
    loadOffers(userId).then(
      (loaded) => {
        if (!cancelled) setOffers(loaded);
      },
      (error: unknown) => {
        if (!cancelled) setFailure(errorText(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId, available]);

  const act = async (key: string, action: () => Promise<string | null>) => {
    if (pending !== null) return;
    setPending(key);
    setFailure(null);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setFailure(errorText(error));
    } finally {
      setPending(null);
    }
  };

  const purchase = (offer: PlanOffer<PurchasesPackage>) =>
    act(offer.pkg.identifier, async () => {
      if (userId === null) return null;
      if ((await buy(userId, offer.pkg)) === "cancelled") return null;
      const plan = await refreshMine({});
      return plan === "free" ? "Your purchase is being confirmed. It can take a minute to appear." : `You are on ${PLAN_NAMES[plan]}.`;
    });

  const restoreBought = () =>
    act("restore", async () => {
      if (userId === null) return null;
      await restore(userId);
      const plan = await refreshMine({});
      return plan === "free" ? "No subscription was found for this account." : `Restored ${PLAN_NAMES[plan]}.`;
    });

  const manage = () =>
    act("manage", async () => {
      if (userId === null) return null;
      const url = await managementUrl(userId);
      if (url === null) return "Manage your subscription in the store you bought it from.";
      await Linking.openURL(url);
      return null;
    });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <PinnedHeader scrolled={pinned.scrolled}>
          <ScreenHeader title="Plans" subtitle={usage ? `You are on ${PLAN_NAMES[usage.plan]}` : undefined} onBack={() => router.back()} backTestID="plans-back" />
        </PinnedHeader>
        <ScrollView contentContainerStyle={styles.content} {...pinned.scrollProps}>
          <ThemedText themeColor="textSecondary">
            Joining Groups, Offline play and My Library are free. A plan lets you create Groups of your own for your Members to join.
          </ThemedText>
          {!signedIn ? (
            <ThemedText type="smallBold" testID="plans-sign-in">
              Sign in with Google to subscribe.
            </ThemedText>
          ) : null}
          {usage && !usage.enforced ? (
            <ThemedText type="smallBold" themeColor="accent" testID="plans-not-enforced">
              {`Plans are not being charged yet. Until they are, everyone can create up to ${LAUNCH_LIMITS.groups} Groups with up to ${LAUNCH_LIMITS.songsPerGroup} Songs each.`}
            </ThemedText>
          ) : null}
          {usage ? (
            <ThemedText type="small" themeColor="textSecondary" testID="plan-usage">
              {usageSummary(usage)}
            </ThemedText>
          ) : null}
          {(["plus", "pro"] as const).map((plan) => {
            const planOffers = (offers ?? []).filter((offer) => offer.plan === plan);
            const current = usage?.plan === plan;
            return (
              <Card key={plan} title={current ? "Your plan" : undefined} heading={PLAN_NAMES[plan]}>
                <View style={styles.perks}>
                  {PLAN_PERKS[plan].map((perk) => (
                    <ThemedText key={perk} type="small">
                      {`• ${perk}`}
                    </ThemedText>
                  ))}
                </View>
                {signedIn && !current && available ? (
                  <View style={styles.buttons}>
                    {offers === null && failure === null ? (
                      <ThemedText type="caption" themeColor="textSecondary">
                        Loading prices…
                      </ThemedText>
                    ) : null}
                    {planOffers.map((offer) => (
                      <ActionButton
                        key={offer.pkg.identifier}
                        accent={offer.billing === "annual"}
                        label={`${offer.price} ${BILLING_LABEL[offer.billing]}`}
                        accessibleName={`Subscribe to ${PLAN_NAMES[plan]} for ${offer.price} ${BILLING_LABEL[offer.billing]}`}
                        testID={`buy-${plan}-${offer.billing}`}
                        pending={pending === offer.pkg.identifier}
                        disabled={pending !== null}
                        onPress={() => void purchase(offer)}
                      />
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}
          {signedIn && !available ? (
            <ThemedText type="small" themeColor="textSecondary" testID="plans-unavailable">
              Subscriptions are not available in this build of the app.
            </ThemedText>
          ) : null}
          {message ? (
            <ThemedText type="smallBold" themeColor="accent" testID="plans-message" role="status">
              {message}
            </ThemedText>
          ) : null}
          {failure ? (
            <ThemedText type="small" themeColor="danger" testID="plans-error" role="alert">
              {failure}
            </ThemedText>
          ) : null}
          {signedIn && available ? (
            <View style={styles.buttons}>
              {canRestore ? (
                <ActionButton variant="outline" label="Restore purchases" testID="restore-purchases" pending={pending === "restore"} disabled={pending !== null} onPress={() => void restoreBought()} />
              ) : null}
              {usage && usage.plan !== "free" ? (
                <ActionButton variant="outline" label="Manage subscription" testID="manage-subscription" pending={pending === "manage"} disabled={pending !== null} onPress={() => void manage()} />
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: PINNED_CONTENT_TOP,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  perks: { gap: Spacing.one },
  buttons: { gap: Spacing.two },
});
