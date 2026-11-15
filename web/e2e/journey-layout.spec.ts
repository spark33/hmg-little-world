import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 960, height: 480 },
  { width: 540, height: 960 },
]) {
  test(`collection fits and edited memory stays readable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: /^Collection ·/ }).click();
    const geometry = await page.locator(".task-content").evaluate((e) => ({
      scroll: e.scrollHeight,
      height: e.clientHeight,
      width: e.scrollWidth,
      clientWidth: e.clientWidth,
    }));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.height + 1);
    expect(geometry.width).toBeLessThanOrEqual(geometry.clientWidth + 1);
    await page
      .getByRole("button", { name: /Gwangjang Market flavors/ })
      .click();
    const note = page.getByLabel("Memory note", { exact: true });
    await expect(note).toContainText("A market afternoon");
    const next = page.getByRole("region", { name: "Curated next chapter" });
    await expect(next).toContainText("Mangwon Market picnic");
    await page.getByRole("button", { name: "Edit note", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Memory note", exact: true })
      .fill("Our market afternoon.");
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(note).toContainText("Our market afternoon.");
    await expect(note).toBeFocused();
    const box = await note.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  });
}
