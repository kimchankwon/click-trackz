import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { revenueCatWebhook } from "./subscriptions";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/revenuecat", method: "POST", handler: revenueCatWebhook });

export default http;
