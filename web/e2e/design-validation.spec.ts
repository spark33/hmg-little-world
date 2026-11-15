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

const newKeepsakes = [
  ["Mangwon Market picnic", "Find a Mangwon picnic"],
  ["Gyeongbokgung palace walk", "Find a palace walk"],
  ["Bukhansan trail morning", "Find a Bukhansan trail"],
  ["Seoul museum afternoon", "Find a Seoul art adventure"],
] as const;
async function confirmNext(page: Page, action: string) {
  await page
    .getByRole("button", { name: "Find a little adventure", exact: true })
    .click();
  await page.getByRole("button", { name: action, exact: true }).click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate journey", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to my world", exact: true })
    .click();
  await expect(
    page.getByText("Your little world just got bigger!", { exact: false }),
  ).toBeVisible();
}

test("all eight UI-collected keepsakes expose the right details and an uncropped illustration", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  for (const [, action] of newKeepsakes) await confirmNext(page, action);
  const records = await page.evaluate(
    () => JSON.parse(localStorage.getItem("little-world:v1")!).collected,
  );
  expect(Object.keys(records)).toHaveLength(8);
  const titles = [
    "Gwangjang Market flavors",
    "Namsan evening lights",
    "Seokchon Lake blossoms",
    "Seongsu slow morning",
    ...newKeepsakes.map(([title]) => title),
  ];
  for (const [index, title] of titles.entries()) {
    await page.getByRole("button", { name: /My collection/ }).click();
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        index < 4 ? /ILLUSTRATIVE MEMORY/ : /CONFIRMED DEMO KEEPSAKE/,
      ),
    ).toBeVisible();
    const geometry = await page
      .locator(".memory-illustration")
      .evaluate((el) => {
        const frame = el.getBoundingClientRect(),
          icon = el.querySelector(".keepsake-icon")!.getBoundingClientRect();
        return {
          fits:
            icon.left >= frame.left - 1 &&
            icon.top >= frame.top - 1 &&
            icon.right <= frame.right + 1 &&
            icon.bottom <= frame.bottom + 1,
          shapes: el.querySelectorAll(
            ".keepsake-icon path,.keepsake-icon circle,.keepsake-icon ellipse",
          ).length,
        };
      });
    expect(geometry.fits, title).toBe(true);
    expect(geometry.shapes, title).toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "Close panel", exact: true })
      .click();
  }
  await page.reload();
  await expect(
    page.getByText("8 memories made. Your demo collection is complete.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("confirmed memory editing enforces the typed 500-character limit without changing visit provenance", async ({
  page,
}) => {
  await page.goto("/");
  await confirmNext(page, "Find a Mangwon picnic");
  const previous = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("little-world:v1")!).collected.mangwon,
  );
  await page.getByRole("button", { name: /My collection/ }).click();
  await page.getByRole("button", { name: /Mangwon Market picnic/ }).click();
  await page
    .getByRole("button", { name: "Edit memory note", exact: true })
    .click();
  const note = page.getByRole("textbox", { name: "Memory note", exact: true });
  await note.fill("서울의 오후 🌿\n" + "m".repeat(480));
  await note.pressSequentially(
    " A longer ending that must stop at the boundary.",
  );
  const expected = await note.inputValue();
  expect(expected.length).toBe(500);
  expect(expected).toContain("서울의 오후 🌿");
  await page.getByRole("button", { name: "Save memory", exact: true }).click();
  await page.reload();
  const actual = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("little-world:v1")!).collected.mangwon,
  );
  expect(actual).toEqual({ ...previous, memory: expected });
  expect(actual.provenance).toBe("confirmed-demo");
});

test("manual clipboard fallback selects the complete backup and invalid input leaves the world unchanged", async ({
  page,
}) => {
  await page.goto("/");
  const original = await page.evaluate(() =>
    localStorage.getItem("little-world:v1"),
  );
  await page
    .getByRole("button", { name: "Demo settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare world backup", exact: true })
    .click();
  const exported = page.getByRole("textbox", { name: "Exported world backup" });
  const backup = await exported.inputValue();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    }),
  );
  await page
    .getByRole("button", { name: "Copy complete backup", exact: true })
    .click();
  await expect(
    page.getByText("The complete backup is selected", { exact: false }),
  ).toBeVisible();
  const selection = await exported.evaluate((el: HTMLTextAreaElement) => ({
    start: el.selectionStart,
    end: el.selectionEnd,
    focused: document.activeElement === el,
  }));
  expect(selection).toEqual({ start: 0, end: backup.length, focused: true });
  await page
    .getByRole("textbox", { name: "Paste a world backup", exact: true })
    .fill("not a backup");
  await page
    .getByRole("button", { name: "Review imported world", exact: true })
    .click();
  await expect(page.locator(".backup-feedback[role=alert]")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("little-world:v1")),
  ).toBe(original);
});

test("a browser driving event dismisses an unconfirmed backup replacement without writing it", async ({
  page,
}) => {
  await page.goto("/");
  const original = await page.evaluate(() =>
    localStorage.getItem("little-world:v1"),
  );
  await page
    .getByRole("button", { name: "Demo settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare world backup", exact: true })
    .click();
  const backup = await page
    .getByRole("textbox", { name: "Exported world backup" })
    .inputValue();
  await page
    .getByRole("textbox", { name: "Paste a world backup", exact: true })
    .fill(backup);
  await page
    .getByRole("button", { name: "Review imported world", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Confirm world replacement" }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("vehicle-safety", {
        detail: { state: "driving", preview: false },
      }),
    ),
  );
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("little-world:v1")),
  ).toBe(original);
  // This restores only the explicitly non-vehicle browser preview, never PARKED.
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("vehicle-safety", {
        detail: { state: "unknown", preview: true },
      }),
    ),
  );
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Demo settings", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Confirm world replacement" }),
  ).toHaveCount(0);
});
