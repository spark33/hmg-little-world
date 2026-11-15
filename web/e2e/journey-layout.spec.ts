import { test, expect, type Locator } from "@playwright/test";

async function contrastOnSurface(text: Locator, surface: Locator) {
  const foreground = await text.evaluate((el) => getComputedStyle(el).color);
  const background = await surface.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => a - b,
  );
  return (values[1] + 0.05) / (values[0] + 0.05);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 960, height: 480 },
  { width: 360, height: 480 },
]) {
  test(`curated rationale and updated note remain readable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: /My collection/ }).click();
    const confirmed = page.getByRole("region", {
      name: "Confirmed demo keepsakes",
      exact: true,
    });
    const seeded = page.getByRole("region", {
      name: "Seeded illustrations",
      exact: true,
    });
    await expect(confirmed).toContainText("not verified visits");
    await expect(seeded).toContainText("not places you have visited");
    await seeded
      .getByRole("button", { name: /Gwangjang Market flavors/ })
      .click();
    const recommendation = page.getByRole("region", {
      name: "Curated next chapter",
    });
    await expect(recommendation.getByRole("heading", { level: 3 })).toHaveText(
      "Mangwon Market picnic",
    );
    for (const selector of [".eyebrow", "h3", "p"]) {
      const text = recommendation.locator(selector);
      await text.scrollIntoViewIfNeeded();
      expect(
        await contrastOnSurface(text, recommendation),
      ).toBeGreaterThanOrEqual(4.5);
      const geometry = await text.evaluate((el) => {
        const text = el.getBoundingClientRect();
        const panel = el.closest("aside")!.getBoundingClientRect();
        return {
          left: text.left,
          right: text.right,
          panelLeft: panel.left,
          panelRight: panel.right,
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(geometry.panelLeft);
      expect(geometry.right).toBeLessThanOrEqual(geometry.panelRight);
    }
    await page
      .getByRole("button", { name: "Edit memory note", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Memory note", exact: true })
      .fill("서울 — our market memory.");
    await page
      .getByRole("button", { name: "Save memory", exact: true })
      .click();
    const quote = page.locator(".memory-quote");
    await expect(quote).toHaveText("“서울 — our market memory.”");
    await expect(quote).toBeFocused();
    await expect(page.getByRole("status")).toContainText("Memory note updated");
    const geometry = await quote.evaluate((el) => {
      const quote = el.getBoundingClientRect();
      const panel = el.closest("aside")!.getBoundingClientRect();
      const top = el
        .closest("aside")!
        .querySelector(".panel-top")!
        .getBoundingClientRect();
      return {
        top: quote.top,
        bottom: quote.bottom,
        headerBottom: top.bottom,
        panelBottom: panel.bottom,
      };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.panelBottom + 1);
  });
}
