# Convex deployments live in Sydney

Clock-offset error is bounded by half the round trip to the Convex server, so the deployment region directly limits how closely Members' devices agree (ADR 0001). The Group plays in Australia, where Sydney (ap-southeast-2) is 10 to 30 ms away and US East is 150 ms or more. We accept Sydney's roughly 1.3x usage pricing because alignment is the product, and moving a Convex deployment between regions later means a data export and a new deployment URL in every client.
