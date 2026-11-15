import { test, expect } from "@playwright/test";

test("changing a scrolled collection panel reveals the next heading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 480 });
  await page.goto("/");
  await page.getByRole("button", { name: /My collection/ }).click();
  await page
    .getByRole("button", { name: "Browse all keepsakes", exact: true })
    .click();
  const panel = page.getByRole("complementary");
  await expect(panel).toBeFocused();
  const geometry = await panel.locator("h2").evaluate((heading) => {
    const bounds = heading.getBoundingClientRect();
    const container = heading.closest("aside")!.getBoundingClientRect();
    const hit = document.elementFromPoint(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      containerTop: container.top,
      containerBottom: container.bottom,
      reachable: !!hit && heading.contains(hit),
    };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.containerTop);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.containerBottom);
  expect(geometry.reachable).toBe(true);
  await expect(panel).toHaveJSProperty("scrollTop", 0);
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
  await page.getByRole("button", { name: "Demo settings" }).click();
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
    page.getByRole("button", { name: "Reset demo world", exact: true }),
  ).toBeAttached();
});
