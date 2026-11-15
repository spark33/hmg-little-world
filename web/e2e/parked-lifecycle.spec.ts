import { test, expect } from "@playwright/test";
import { chooseNextChapter } from "./helpers";
async function arrival(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await chooseNextChapter(page);
  await page
    .getByRole("button", { name: "Choose a place", exact: true })
    .click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page
    .getByRole("button", { name: "Review memory", exact: true })
    .click();
}
async function safety(
  page: import("@playwright/test").Page,
  state: "driving" | "unknown",
  preview: boolean,
) {
  await page.evaluate(
    (detail) =>
      window.dispatchEvent(new CustomEvent("vehicle-safety", { detail })),
    { state, preview },
  );
}
test("driving cancels an unconfirmed memory and never offers to resume its confirmation", async ({
  page,
}) => {
  await page.goto("/");
  await arrival(page);
  await safety(page, "driving", true);
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await safety(page, "unknown", true);
  await expect(
    page.getByRole("button", { name: "Continue browsing", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Collection · 0 memories/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected.mangwon,
    ),
  ).toBeUndefined();
});
test("confirmed progress survives interruption without replaying the reveal", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await arrival(page);
  await page.getByRole("button", { name: "Keep memory", exact: true }).click();
  await safety(page, "driving", false);
  await safety(page, "unknown", true);
  await expect(
    page.getByText("Your keepsake was saved. The reveal has been paused."),
  ).toBeVisible();
  await expect(
    page.getByText("A little memory is finding its home…"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Collection · 1 memory/ }),
  ).toBeVisible();
});
test("an interrupted note draft requires deliberate continuation and is not silently saved", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Collection ·/ }).click();
  await page.getByRole("button", { name: /Gwangjang Market flavors/ }).click();
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  const original = await page.evaluate(() =>
    localStorage.getItem("little-world:v1"),
  );
  await page
    .getByRole("textbox", { name: "Memory note", exact: true })
    .fill("An unfinished memory note.");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Continue browsing", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Memory note", exact: true }),
  ).toHaveValue("An unfinished memory note.");
  expect(
    await page.evaluate(() => localStorage.getItem("little-world:v1")),
  ).toBe(original);
});
