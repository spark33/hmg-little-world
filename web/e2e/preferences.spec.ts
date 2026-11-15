import { test, expect } from "@playwright/test";

test("ROAMY preferences persist, panels take focus, Escape returns to the opener", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ROAMY/);
  const opener = page.getByRole("button", { name: "Demo settings" });
  await opener.click();
  await expect(page.getByRole("complementary")).toBeFocused();
  await page.getByRole("button", { name: "Switch to evening" }).click();
  await page.getByRole("button", { name: "Mute sound" }).click();
  await page.getByRole("button", { name: "Reduce motion" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.reload();
  await expect(page.locator("main.app")).toHaveClass(/night/);
  await expect(page.locator("main.app")).toHaveClass(/reduced-motion/);
  await opener.click();
  await expect(
    page.getByRole("button", { name: "Enable sound" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reduce motion" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("system reduced motion skips reveal and saves a confirmed memory immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("main.app")).toHaveClass(/reduced-motion/);
  await page.getByRole("button", { name: "Find a little adventure" }).click();
  await page.getByRole("button", { name: "Find deep-dish pizza" }).click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page.getByRole("button", { name: "Simulate journey" }).click();
  await page.getByRole("button", { name: "Add to my world" }).click();
  await expect(
    page.getByText("Your little world just got bigger!"),
  ).toBeVisible();
  await expect(
    page.getByText("A little memory is finding its home…"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected.chicago,
    ),
  ).toBeTruthy();
  await page.reload();
  await expect(
    page.getByText("5 memories made. So many more to come."),
  ).toBeVisible();
});

test("narrow screens retain preview disclosure and the collection accessible name", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.goto("/");
  await expect(
    page.getByText("Browser development preview", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "My collection · 4 memories" }),
  ).toBeVisible();
});
