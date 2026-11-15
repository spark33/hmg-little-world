import { expect, type Page } from "@playwright/test";
export async function chooseNextChapter(page: Page) {
  const choices = page.locator(".discovery-shelf .shelf-item");
  await expect(choices.first()).toBeVisible();
  await choices.first().click();
}
export async function settingsSection(
  page: Page,
  section: "Memories" | "Connections" | "About",
) {
  await page.getByRole("button", { name: section, exact: true }).click();
}
export async function openBackup(page: Page) {
  await settingsSection(page, "Memories");
  await page
    .getByRole("button", { name: "Backup and recovery", exact: true })
    .click();
}
export async function openCollectionItem(
  page: Page,
  title: string,
  view: "Inspiration" | "My memories" | "Earlier memories" = "My memories",
) {
  await page.getByRole("button", { name: /^Collection ·/ }).click();
  await page.getByRole("tab", { name: new RegExp("^" + view) }).click();
  for (let i = 0; i < 8; i++) {
    const choice = page.getByRole("button", { name: new RegExp(title) });
    if (await choice.count()) {
      await choice.click();
      return;
    }
    await page
      .getByRole("button", { name: "Next keepsakes", exact: true })
      .click();
  }
  throw new Error("Keepsake not found: " + title);
}
