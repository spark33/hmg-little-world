import { test, expect } from "@playwright/test";

test("returning from a memory preserves its paged collection context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 480 });
  await page.goto("/");
  await page.getByRole("button", { name: /^Collection ·/ }).click();
  await page
    .getByRole("button", { name: "Next keepsakes", exact: true })
    .click();
  await page.getByRole("button", { name: /Seokchon Lake blossoms/ }).click();
  await page
    .getByRole("button", { name: "Back to collection", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Outing inspiration" }),
  ).toContainText("Seokchon Lake blossoms");
  await expect(
    page.getByRole("navigation", { name: "Collection pages" }),
  ).toContainText("2 of 2");
  const box = await page
    .locator(".task-content")
    .evaluate((e) => ({ height: e.clientHeight, scroll: e.scrollHeight }));
  expect(box.scroll).toBeLessThanOrEqual(box.height + 1);
});

test("unavailable bundled licenses can be retried without leaving settings", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/third-party-notices.txt", async (route) => {
    requests += 1;
    await route.fulfill(
      requests === 1
        ? { status: 503, body: "unavailable" }
        : {
            status: 200,
            contentType: "text/plain",
            body: "Verified local license text",
          },
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "About", exact: true }).click();
  await page.getByText("Open-source licenses", { exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Bundled notices could not be read",
  );
  await page.getByRole("button", { name: "Retry reading licenses" }).click();
  await expect(page.getByLabel("Bundled open-source license text")).toHaveText(
    "Verified local license text",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(requests).toBe(2);
  await expect(
    page.getByRole("button", { name: "About", exact: true }),
  ).toBeAttached();
});
