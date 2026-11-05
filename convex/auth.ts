import Google from "@auth/core/providers/google";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, createAccount, retrieveAccount } from "@convex-dev/auth/server";

import type { DataModel } from "./_generated/dataModel";

const DevLogin = ConvexCredentials<DataModel>({
  id: "dev",
  authorize: async (credentials, ctx) => {
    const expected = process.env.DEV_LOGIN_SECRET;
    if (!expected || String(credentials.secret ?? "") !== expected) throw new Error("Dev login is not enabled");
    const email = String(credentials.email ?? "").trim().toLowerCase();
    if (!email.endsWith("@example.com")) throw new Error("Dev login only accepts @example.com addresses");
    const existing = await retrieveAccount(ctx, { provider: "dev", account: { id: email } }).catch(() => null);
    if (existing) return { userId: existing.user._id };
    const { user } = await createAccount(ctx, {
      provider: "dev",
      account: { id: email },
      profile: { email, name: email.split("@")[0] },
    });
    return { userId: user._id };
  },
});

const allowedRedirect = (redirectTo: string) => {
  const siteUrl = process.env.SITE_URL;
  return (
    (siteUrl !== undefined && (redirectTo === siteUrl || redirectTo.startsWith(`${siteUrl}/`))) ||
    /^http:\/\/localhost(:\d+)?(\/|$|\?)/.test(redirectTo) ||
    redirectTo.startsWith("cuetracker://") ||
    /^exp:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?([/?]|$)/.test(redirectTo)
  );
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Anonymous,
    Google({ authorization: { params: { prompt: "select_account" } } }),
    ...(process.env.DEV_LOGIN_SECRET ? [DevLogin] : []),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) return `${process.env.SITE_URL ?? ""}${redirectTo}`;
      if (allowedRedirect(redirectTo)) return redirectTo;
      throw new Error(`Invalid redirectTo: ${redirectTo}`);
    },
  },
});
