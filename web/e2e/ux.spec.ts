import { test, expect } from "@playwright/test";
import { chooseNextChapter } from "./helpers";
test("parked controls are large and the world uses the available canvas", async ({
  page,
}) => {
  for (const viewport of [
    { width: 960, height: 480 },
    { width: 1280, height: 720 },
    { width: 1920, height: 720 },
    { width: 540, height: 960 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    for (const name of [
      "Settings",
      "Show whole world",
      "Zoom in",
      "Zoom out",
      "Discover",
    ]) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(64);
      expect(box!.height).toBeGreaterThanOrEqual(64);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
  }
});
test("comfort settings fit a short landscape window without scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 480 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const name of ["Switch to evening", "Mute sound", "Reduce motion"]) {
    const control = page.getByRole("button", { name, exact: true });
    await expect(control).toBeVisible();
    const b = await control.boundingBox();
    expect(b!.y + b!.height).toBeLessThanOrEqual(480);
  }
  const geometry = await page
    .locator(".task-content")
    .evaluate((e) => ({ height: e.clientHeight, scroll: e.scrollHeight }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.height + 1);
  await page.getByRole("button", { name: "Memories", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reset my world", exact: true }),
  ).toBeVisible();
});
test("destination comparison fits all three choices on a short car display", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 480 });
  await page.goto("/");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await chooseNextChapter(page);
  await page
    .getByRole("button", { name: "Choose a place", exact: true })
    .click();
  const options = page.locator(".destination");
  await expect(options).toHaveCount(3);
  for (const option of await options.all()) {
    const b = await option.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(64);
    expect(b!.y + b!.height).toBeLessThanOrEqual(480);
    const internal = await option.evaluate((e) => ({
      scroll: e.scrollHeight,
      height: e.clientHeight,
    }));
    expect(internal.scroll).toBeLessThanOrEqual(internal.height + 1);
  }
  await options.nth(1).click();
  await expect(options.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(options.first()).toHaveAttribute("aria-pressed", "false");
});
test("editing offers Save and Cancel without discovery actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Collection ·/ }).click();
  await page.locator(".shelf-item").first().click();
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save note", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Explore /, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /^Explore /, exact: true }),
  ).toBeVisible();
});
test("home identity is global and development copy is absent", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText(
    "Our little corner of Seoul",
  );
  await expect(page.locator("body")).not.toContainText(
    "Browser development preview",
  );
  await expect(
    page.getByRole("button", { name: "Discover", exact: true }),
  ).toBeVisible();
});
