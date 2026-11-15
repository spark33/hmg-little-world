import { test, expect } from "@playwright/test";

function contrast(first: string, second: string) {
  function luminance(color: string) {
    const channels = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const [low, high] = [luminance(first), luminance(second)].sort(
    (a, b) => a - b,
  );
  return (high + 0.05) / (low + 0.05);
}

test("secondary guidance and safety text retain readable contrast", async ({
  page,
}) => {
  await page.goto("/");
  const preview = await page
    .locator(".preview-tag")
    .evaluate((el) => getComputedStyle(el).color);
  const backdrop = await page
    .locator("main.app")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(contrast(preview, backdrop)).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("button", { name: "Demo settings" }).click();
  for (const selector of [".panel .fine-print", ".panel .secondary"]) {
    const color = await page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    const background = await page
      .locator(".panel")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(contrast(color, background), selector).toBeGreaterThanOrEqual(4.5);
  }
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("vehicle-safety", {
        detail: { state: "driving", preview: false },
      }),
    ),
  );
  await expect(page.locator("canvas")).toHaveCount(0);
  const safetyBackground = await page
    .locator(".safe-screen")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  for (const selector of [
    ".safe-screen p",
    ".safe-screen small",
    ".safe-screen .mode-tag",
  ]) {
    const color = await page
      .locator(selector)
      .evaluate((el) => getComputedStyle(el).color);
    expect(contrast(color, safetyBackground), selector).toBeGreaterThanOrEqual(
      4.5,
    );
  }
});

test("short landscape settings controls scroll into a clear touchable position", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 480 });
  await page.goto("/");
  await page.getByRole("button", { name: "Demo settings" }).click();
  await expect(page.getByRole("complementary")).toBeFocused();
  for (const name of [
    "Switch to evening",
    "Mute sound",
    "Reduce motion",
    "Reset demo world",
  ]) {
    const control = page.getByRole("button", {
      name: name === "Reduce motion" ? /^Reduce motion/ : name,
      exact: name !== "Reduce motion",
    });
    await control.focus();
    await expect(control).toBeFocused();
    const geometry = await control.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const target = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return {
        width: box.width,
        height: box.height,
        reachable: target !== null && el.contains(target),
      };
    });
    expect(geometry.width).toBeGreaterThanOrEqual(56);
    expect(geometry.height).toBeGreaterThanOrEqual(56);
    expect(geometry.reachable, name).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Demo settings" }),
  ).toBeFocused();
});

test("narrow settings retain preview disclosure and actionable storage warnings", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  for (const width of [640, 360]) {
    await page.setViewportSize({ width, height: 480 });
    await page.goto("/");
    await page.getByRole("button", { name: "Demo settings" }).click();
    const preview = page.getByText("Browser development preview", {
      exact: true,
    });
    const panel = page.getByRole("complementary");
    const alert = page.getByRole("alert");
    const retry = page.getByRole("button", { name: "Retry save", exact: true });
    await expect(preview).toBeVisible();
    await expect(alert).toContainText("session only");
    await expect(retry).toBeVisible();
    const [previewBox, panelBox, alertBox] = await Promise.all([
      preview.boundingBox(),
      panel.boundingBox(),
      alert.boundingBox(),
    ]);
    expect(previewBox!.y + previewBox!.height).toBeLessThanOrEqual(panelBox!.y);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(alertBox!.y);
    expect(alertBox!.y + alertBox!.height).toBeLessThanOrEqual(480);
    await retry.click(); // A failed retry must remain actionable rather than vanish.
    await expect(alert).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(page.getByRole("complementary")).toHaveCount(0);
  }
});

test("narrow camera and header controls keep 56px touch targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  for (const name of [
    "Demo settings",
    "Show whole world",
    "Zoom in",
    "Zoom out",
  ]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box!.width, name).toBeGreaterThanOrEqual(56);
    expect(box!.height, name).toBeGreaterThanOrEqual(56);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  }
});
