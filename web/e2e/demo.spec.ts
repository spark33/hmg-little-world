import { test, expect } from "@playwright/test";
const evidence = process.env.EVIDENCE_DIR || "../artifacts";
test("complete Detroit → Chicago flow, explicit consent, seven-second reveal, reload and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: /My collection/ }).click();
  await page.getByRole("button", { name: /Detroit-style pizza/ }).click();
  await expect(
    page.getByText("Our first Detroit-style pizza!", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Demo Detroit pizza restaurant")).toBeVisible();
  await page.getByRole("button", { name: "Meet your next keepsake" }).click();
  await page.screenshot({ path: `${evidence}/recommendation.png` });
  await page.getByRole("button", { name: "Find deep-dish pizza" }).click();
  await expect(
    page.getByText("Illustrative venues. No live availability or route data."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Iconic Chicago destination/ })
    .click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await expect(
    page.getByText(
      "Live navigation is unavailable. This is a sample destination.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate journey" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected.chicago,
    ),
  ).toBeUndefined();
  await page.getByRole("button", { name: "Not yet", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected.chicago,
    ),
  ).toBeUndefined();
  await page.getByRole("button", { name: "Find a little adventure" }).click();
  await page.getByRole("button", { name: "Find deep-dish pizza" }).click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page.getByRole("button", { name: "Simulate journey" }).click();
  const start = Date.now();
  await page.getByRole("button", { name: "Add to my world" }).click();
  await expect(
    page.getByText("A little memory is finding its home…"),
  ).toBeVisible();
  await page.waitForTimeout(2800);
  await page.screenshot({ path: `${evidence}/collection-midway.png` });
  await expect(
    page.getByText("Your little world just got bigger!"),
  ).toBeVisible({ timeout: 15000 });
  expect(Date.now() - start).toBeGreaterThanOrEqual(6500);
  await page.screenshot({ path: `${evidence}/world-collected.png` });
  await page.reload();
  await expect(
    page.getByText("5 memories made. So many more to come."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Demo settings" }).click();
  await page.getByRole("button", { name: "Reset demo world" }).click();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByText("4 memories made. So many more to come."),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("driving and unknown vehicle state remove all interactive content", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("vehicle-safety", {
        detail: { state: "driving", preview: true },
      }),
    ),
  );
  await expect(page.getByText("Your little world can wait.")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("vehicle-safety", {
        detail: { state: "unknown", preview: false },
      }),
    ),
  );
  await expect(page.locator("canvas")).toHaveCount(0);
});
test("safety interruption cancels collection animation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Find a little adventure" }).click();
  await page.getByRole("button", { name: "Find deep-dish pizza" }).click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page.getByRole("button", { name: "Simulate journey" }).click();
  await page.getByRole("button", { name: "Add to my world" }).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("vehicle-safety", {
        detail: { state: "driving", preview: false },
      }),
    ),
  );
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(
    page.getByText("A little memory is finding its home…"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("5 memories made. So many more to come."),
  ).toBeVisible();
  await expect(
    page.getByText("A little memory is finding its home…"),
  ).toHaveCount(0);
});
test("automotive display sizes keep large touch targets and the primary action clear", async ({
  browser,
}) => {
  for (const [width, height] of [
    [960, 480],
    [1024, 600],
    [1280, 720],
    [1920, 720],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page.waitForTimeout(1600);
    for (const label of [
      "Show whole world",
      "Zoom in",
      "Zoom out",
      "Find a little adventure",
    ]) {
      const box = await page.getByRole("button", { name: label }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(56);
      expect(box!.height).toBeGreaterThanOrEqual(56);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    }
    expect(
      await page
        .locator("canvas")
        .evaluate((el) => (el as HTMLCanvasElement).width / el.clientWidth),
    ).toBeLessThanOrEqual(1.26);
    await page.screenshot({ path: `${evidence}/vehicle-world-${width}.png` });
    await page.getByRole("button", { name: "Find a little adventure" }).tap();
    await expect(
      page.getByRole("button", { name: "Find deep-dish pizza" }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const panel = await page
          .getByRole("complementary", { name: "Adventure details" })
          .boundingBox();
        return panel!.x + panel!.width;
      })
      .toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `${evidence}/vehicle-discovery-${width}.png`,
    });
    await context.close();
  }
});

test("a building can be selected directly on the 3D canvas", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForTimeout(2500);
  await page.mouse.click(538, 403);
  await expect(page.getByText("Demo Detroit pizza restaurant")).toBeVisible();
});
