import { expect, test, type Page } from "@playwright/test";

import featureMap from "./feature-map.json";

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not set; run this through npm run verify`);
  return value;
};

const selected = new Set(required(process.env.VERIFY_FLOWS, "VERIFY_FLOWS").split(","));
const shotsDir = required(process.env.VERIFY_SHOTS_DIR, "VERIFY_SHOTS_DIR");
const groupName = required(process.env.VERIFY_GROUP_NAME, "VERIFY_GROUP_NAME");
const songTitle = required(process.env.VERIFY_SONG_TITLE, "VERIFY_SONG_TITLE");

const openSignedOut = async (page: Page) => {
  await page.goto("/");
  await expect(page.getByText("Multiple devices, one beat")).toBeVisible({ timeout: 90_000 });
};

const openDevLogin = async (page: Page) => {
  await openSignedOut(page);
  await page.goto("/dev-login");
  await expect(page.getByText("Dev login")).toBeVisible();
  await page.getByTestId("dev-secret").fill(required(process.env.VERIFY_DEV_SECRET, "VERIFY_DEV_SECRET"));
};

const submitDevLogin = async (page: Page) => {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(groupName)).toBeVisible();
};

const signIn = async (page: Page) => {
  await openDevLogin(page);
  await submitDevLogin(page);
};

const flows: Record<string, (page: Page, shot: () => Promise<void>) => Promise<void>> = {
  smoke: async (page, shot) => {
    await openSignedOut(page);
    await expect(page.getByTestId("about-get-started")).toBeVisible();
    await shot();
  },
  "home-signed-out": async (page, shot) => {
    await openSignedOut(page);
    await page.getByTestId("about-get-started").click();
    await expect(page.getByText("Continue as guest")).toBeVisible();
    await expect(page.getByText("Sign in with Google")).toBeVisible();
    await shot();
  },
  about: async (page, shot) => {
    await openSignedOut(page);
    await page.getByTestId("about-get-started").click();
    await page.getByText("About Click Trackz").click();
    await expect(page).toHaveURL(/\/about$/);
    await page.getByText("From rehearsals to the stage").scrollIntoViewIfNeeded();
    await shot();
  },
  "dev-login": async (page, shot) => {
    await openDevLogin(page);
    await shot();
    await submitDevLogin(page);
  },
  "home-signed-in": async (page, shot) => {
    await signIn(page);
    await expect(page.getByText("Your Groups")).toBeVisible();
    await expect(page.getByText("Join a Group")).toBeVisible();
    await shot();
  },
  group: async (page, shot) => {
    await signIn(page);
    await page.getByText(groupName).click();
    await expect(page.getByText("Pick a Song", { exact: true })).toBeVisible();
    await shot();
  },
  song: async (page, shot) => {
    await signIn(page);
    await page.getByText(groupName).click();
    await page.getByRole("tab", { name: "Songs" }).click();
    await page.getByRole("radio", { name: "Songs" }).click();
    await page.getByRole("button", { name: `Edit ${songTitle}` }).click();
    await expect(page).toHaveURL(/\/song\//);
    await expect(page.getByText("Count-in")).toBeVisible();
    await shot();
  },
  "sound-settings": async (page, shot) => {
    await signIn(page);
    await page.getByRole("tab", { name: "Sound" }).click();
    await expect(page.getByText("Mix")).toBeVisible();
    await shot();
  },
};

for (const { id, screen } of featureMap.flows) {
  if (!selected.has(id)) continue;
  test(id, async ({ page }) => {
    const flow = flows[id];
    if (!flow) throw new Error(`No web flow for ${id}`);
    await flow(page, async () => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.screenshot({ path: `${shotsDir}/${screen}.png`, animations: "disabled" });
    });
  });
}
