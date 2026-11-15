import { test, expect, type Locator, type Page } from "@playwright/test";

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
async function textContrast(locator: Locator) {
  await locator.first().scrollIntoViewIfNeeded();
  const colors = await locator.first().evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    let current: Element | null = element;
    let background = "rgb(255, 255, 255)";
    while (current) {
      const color = getComputedStyle(current).backgroundColor;
      const rect = current.getBoundingClientRect();
      const coversText =
        center.x >= rect.left &&
        center.x <= rect.right &&
        center.y >= rect.top &&
        center.y <= rect.bottom;
      if (
        coversText &&
        color !== "rgba(0, 0, 0, 0)" &&
        color !== "transparent"
      ) {
        background = color;
        break;
      }
      current = current.parentElement;
    }
    return { foreground: getComputedStyle(element).color, background };
  });
  return contrast(colors.foreground, colors.background);
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("memory illustrations fit inside their visible frame and facts retain readable contrast", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /My collection/ }).click();
  await page.getByRole("button", { name: /Gwangjang Market flavors/ }).click();
  const frame = page.locator(".memory-illustration");
  const geometry = await frame.evaluate((element) => {
    const frame = element.getBoundingClientRect();
    const image = element
      .querySelector(".keepsake-icon")!
      .getBoundingClientRect();
    return {
      frame: {
        x: frame.x,
        y: frame.y,
        right: frame.right,
        bottom: frame.bottom,
      },
      image: {
        x: image.x,
        y: image.y,
        right: image.right,
        bottom: image.bottom,
      },
    };
  });
  expect(geometry.image.x).toBeGreaterThanOrEqual(geometry.frame.x - 1);
  expect(geometry.image.y).toBeGreaterThanOrEqual(geometry.frame.y - 1);
  expect(geometry.image.right).toBeLessThanOrEqual(geometry.frame.right + 1);
  expect(geometry.image.bottom).toBeLessThanOrEqual(geometry.frame.bottom + 1);
  for (const selector of [
    ".panel .back-button",
    ".panel .memory-quote",
    ".panel dt",
  ])
    expect(
      await textContrast(page.locator(selector)),
      selector,
    ).toBeGreaterThanOrEqual(4.5);
});

test("evening mode retains normal-text contrast on wide and narrow surfaces", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Demo settings" }).click();
  await page.getByRole("button", { name: "Switch to evening" }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  for (const width of [1440, 640]) {
    await page.setViewportSize({ width, height: 900 });
    for (const selector of [".preview-tag", ".greeting h1"])
      expect(
        await textContrast(page.locator(selector)),
        `${width}: ${selector}`,
      ).toBeGreaterThanOrEqual(4.5);
    if (width === 1440)
      for (const selector of [
        ".world-name > span:nth-child(2)",
        ".world-name small",
      ])
        expect(
          await textContrast(page.locator(selector)),
          selector,
        ).toBeGreaterThanOrEqual(4.5);
  }
  await page.getByRole("button", { name: "Demo settings" }).click();
  for (const selector of [
    ".panel .back-button",
    ".panel .fine-print",
    ".navigation-status [role=status] p",
    ".panel .backup-privacy",
  ])
    expect(
      await textContrast(page.locator(selector)),
      selector,
    ).toBeGreaterThanOrEqual(4.5);
});

async function openSampleArrival(page: Page) {
  await page
    .getByRole("button", { name: "Find a little adventure", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Find a Mangwon picnic", exact: true })
    .click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate journey", exact: true })
    .click();
}

test("day and evening discovery labels remain readable and destination selection is announced", async ({
  page,
}) => {
  await page.goto("/");
  for (const evening of [false, true]) {
    if (evening) {
      await page
        .getByRole("button", { name: "Demo settings", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Switch to evening", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close panel", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "Find a little adventure", exact: true })
      .click();
    for (const selector of [".preview-caption", ".keepsake-title > span"])
      expect(
        await textContrast(page.locator(selector)),
        selector,
      ).toBeGreaterThanOrEqual(4.5);
    await page
      .getByRole("button", { name: "Find a Mangwon picnic", exact: true })
      .click();
    const options = page.locator(".destination");
    await expect(options.first()).toHaveAttribute("aria-pressed", "true");
    await options.nth(1).click();
    await expect(options.first()).toHaveAttribute("aria-pressed", "false");
    await expect(options.nth(1)).toHaveAttribute("aria-pressed", "true");
    for (const selector of [
      ".destination-number",
      ".destination-body small",
      ".destination-body strong",
      ".destination-body > span",
      ".destination-body em",
      ".distance small",
    ])
      expect(
        await textContrast(page.locator(selector)),
        `${evening}: ${selector}`,
      ).toBeGreaterThanOrEqual(4.5);
    await page.getByRole("button", { name: "Let’s go", exact: true }).click();
    await page
      .getByRole("button", { name: "Simulate journey", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add to my world", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Not yet", exact: true }).click();
  }
});

test("the real reveal caption and progress indicators have readable contrast", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await openSampleArrival(page);
  await page
    .getByRole("button", { name: "Add to my world", exact: true })
    .click();
  await expect(page.locator(".collection-caption")).toBeVisible();
  expect(
    await textContrast(page.locator(".collection-caption")),
  ).toBeGreaterThanOrEqual(4.5);
  const revealColors = await page
    .locator(".collection-caption")
    .evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      fill: getComputedStyle(el.querySelector(".collection-progress")!)
        .backgroundColor,
    }));
  expect(
    contrast(revealColors.fill, revealColors.background),
  ).toBeGreaterThanOrEqual(3);
  await expect(
    page.getByText("Your little world just got bigger!", { exact: false }),
  ).toBeVisible({ timeout: 15000 });
  expect(
    await textContrast(page.locator(".toast small")),
  ).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("button", { name: /My collection/ }).click();
  await page
    .getByRole("button", { name: "Browse all keepsakes", exact: true })
    .click();
  expect(
    await textContrast(page.locator(".collection-progress-summary p")),
  ).toBeGreaterThanOrEqual(4.5);
  const progress = await page
    .getByRole("progressbar", { name: "Confirmed demo keepsakes" })
    .evaluate((el) => ({
      fill: getComputedStyle(el).accentColor,
      background: getComputedStyle(el).backgroundColor,
    }));
  expect(contrast(progress.fill, progress.background)).toBeGreaterThanOrEqual(
    3,
  );
});
