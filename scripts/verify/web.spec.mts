import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { maskTestId, scaleRect, shapeMask, type MaskEntry } from "./mask.mts";
import type { FeatureMap } from "./plan.mts";
import { decodePng, encodePng, fillRects, type Rect } from "./png.mts";

const featureMap = JSON.parse(readFileSync(path.join(import.meta.dirname, "feature-map.json"), "utf8")) as FeatureMap;

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is not set; run this through npm run verify`);
  return value;
};

const selected = new Set(required(process.env.VERIFY_FLOWS, "VERIFY_FLOWS").split(","));
const shotsDir = required(process.env.VERIFY_SHOTS_DIR, "VERIFY_SHOTS_DIR");
const groupName = required(process.env.VERIFY_GROUP_NAME, "VERIFY_GROUP_NAME");
const songTitle = required(process.env.VERIFY_SONG_TITLE, "VERIFY_SONG_TITLE");
const joinCode = required(process.env.VERIFY_JOIN_CODE, "VERIFY_JOIN_CODE");
const guestName = required(process.env.VERIFY_GUEST_NAME, "VERIFY_GUEST_NAME");

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
    await page.evaluate(() => document.fonts.ready);
    const heading = page.getByText("From rehearsals to the stage");
    await expect(async () => {
      await heading.evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(300);
      const settled = await heading.boundingBox();
      expect(Math.abs(settled?.y ?? Number.NaN)).toBeLessThan(1);
    }).toPass({ timeout: 20_000 });
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
  setlist: async (page, shot) => {
    await signIn(page);
    await page.getByText(groupName).click();
    await page.getByRole("tab", { name: "Songs" }).click();
    await page.getByRole("button", { name: "Edit this Setlist" }).click();
    await expect(page).toHaveURL(/\/setlist\//);
    await expect(page.getByText("Edit Setlist")).toBeVisible();
    await expect(page.getByText("This is the Current setlist")).toBeVisible();
    await shot();
  },
  join: async (page, shot) => {
    await page.goto(`/join/${joinCode}`);
    await expect(page.getByText("You have an invite to join a Group.")).toBeVisible({ timeout: 90_000 });
    await shot();
    await page.getByTestId("guest-sign-in").click();
    await expect(page.getByTestId("join-code-input")).toHaveValue(joinCode);
    await page.getByTestId("display-name").fill(guestName);
    await page.getByTestId("join-group").click();
    await expect(page).toHaveURL(/\/group\//);
    await expect(page.getByText("Waiting for Playback", { exact: true })).toBeVisible();
  },
};

const maskBoxes = async (page: Page, mask: readonly MaskEntry[]) => {
  const width = page.viewportSize()?.width ?? 0;
  const rects: Rect[] = [];
  for (const entry of mask) {
    const found = await page.getByTestId(maskTestId(entry)).all();
    const boxes = (await Promise.all(found.map((element) => element.boundingBox()))).filter((box) => box !== null && box.width > 0 && box.height > 0);
    if (boxes.length === 0) throw new Error(`could not mask ${maskTestId(entry)}: no element with that testID is on screen`);
    for (const box of boxes) if (box) rects.push(shapeMask(entry, box, width));
  }
  return { rects, width };
};

const paintMasks = (file: string, rects: readonly Rect[], viewportWidth: number) => {
  const image = decodePng(readFileSync(file));
  const scale = image.width / viewportWidth;
  writeFileSync(file, encodePng(fillRects(image, rects.map((rect) => scaleRect(rect, scale)))));
};

for (const { id, screen, mask = [] } of featureMap.flows) {
  if (!selected.has(id)) continue;
  test(id, async ({ page }) => {
    const flow = flows[id];
    if (!flow) throw new Error(`No web flow for ${id}`);
    await flow(page, async () => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const file = `${shotsDir}/${screen}.png`;
      const masks = mask.length > 0 ? await maskBoxes(page, mask) : null;
      await page.screenshot({ path: file, animations: "disabled" });
      if (masks) paintMasks(file, masks.rects, masks.width);
    });
  });
}
