import { test, expect } from "@playwright/test";
import { initialState } from "../src/domain";

test("collection separates examples and shows newest confirmed demo chapters first", async ({
  page,
}) => {
  const world = initialState();
  world.collected.mangwon = {
    visitDate: "2026-01-01",
    provenance: "confirmed-demo",
  };
  world.collected.bukhansan = {
    visitDate: "2026-02-01",
    provenance: "confirmed-demo",
  };
  world.collected.chicago = {
    visitDate: "2026-03-01",
    provenance: "confirmed-demo",
    memory: "Chicago remains Chicago",
  };
  await page.addInitScript(
    (state) => localStorage.setItem("little-world:v1", JSON.stringify(state)),
    world,
  );
  await page.goto("/");
  await expect(
    page.getByText(
      "2 confirmed demos · 4 illustrations. More chapters await.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: /My collection/ }).click();
  const confirmed = page.getByRole("region", {
    name: "Confirmed demo keepsakes",
    exact: true,
  });
  await expect(confirmed.getByRole("button").first()).toContainText(
    "Bukhansan trail morning",
  );
  await expect(confirmed.getByRole("button").nth(1)).toContainText(
    "Mangwon Market picnic",
  );
  const examples = page.getByRole("region", { name: "Seeded illustrations" });
  await expect(examples.getByRole("button")).toHaveCount(4);
  expect(
    await confirmed.evaluate(
      (el) =>
        el.compareDocumentPosition(
          document.querySelector('[aria-label="Seeded illustrations"]')!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBeTruthy();
  await expect(
    page.getByRole("region", { name: "Earlier demo memories" }),
  ).toContainText("Chicago");
  await confirmed.getByRole("button").first().click();
  await expect(page.locator(".chosen-stop")).toHaveText(
    "Not recorded in this earlier demo memory. No stop is inferred.",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected.bukhansan
          .demoDestinationId,
    ),
  ).toBeUndefined();
  await page
    .locator(".back-button")
    .filter({ hasText: "My collection" })
    .click();
  await expect(confirmed).toBeVisible();
});

test("illustration gives a named curated pairing and both Back steps preserve collection context", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /My collection/ }).click();
  await expect(
    page.getByText("No demo confirmations yet.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Gwangjang Market flavors/ }).click();
  const next = page.getByRole("region", { name: "Curated next chapter" });
  await expect(
    next.getByRole("heading", { name: "Mangwon Market picnic" }),
  ).toBeVisible();
  await expect(next).toContainText("market-food illustration");
  await expect(page.locator(".panel")).not.toContainText("You’ve explored");
  await page
    .getByRole("button", { name: "Discover Mangwon Market picnic" })
    .click();
  await page
    .locator(".back-button")
    .filter({ hasText: "Source memory" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Gwangjang Market flavors",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator(".back-button")
    .filter({ hasText: "My collection" })
    .click();
  await expect(
    page.getByRole("region", { name: "Seeded illustrations" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Browse all keepsakes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cultural experiences", exact: true })
    .click();
  await page.getByRole("button", { name: /Seongsu slow morning/ }).click();
  await page
    .locator(".back-button")
    .filter({ hasText: "All keepsakes" })
    .click();
  await expect(
    page.getByRole("button", { name: "Cultural experiences", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /Gwangjang Market flavors/ }),
  ).toHaveCount(0);
});

test("chosen illustrative stop survives confirmation and reload, with saved note visible and focused", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Find a little adventure", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Find a Mangwon picnic", exact: true })
    .click();
  await page.getByRole("button", { name: /Han River picnic pause/ }).click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page.getByRole("button", { name: "Simulate journey" }).click();
  await page.getByRole("button", { name: "Add to my world" }).click();
  await page.reload();
  await page.getByRole("button", { name: /My collection/ }).click();
  await page
    .getByRole("region", { name: "Confirmed demo keepsakes", exact: true })
    .getByRole("button", { name: /Mangwon Market picnic/ })
    .click();
  await expect(
    page.locator("dd").filter({ hasText: "Han River picnic pause" }),
  ).toContainText("demo choice, not a verified visit");
  await expect(page.locator("dl")).toContainText("demo confirmation date");
  await page
    .getByRole("button", { name: "Edit memory note", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Memory note" })
    .fill("Our river picnic chapter, saved for another day.");
  await page.getByRole("button", { name: "Save memory", exact: true }).click();
  const quote = page.locator(".memory-quote");
  await expect(quote).toBeFocused();
  await expect(quote).toHaveText(
    "“Our river picnic chapter, saved for another day.”",
  );
  const box = await quote.boundingBox();
  expect(box!.y).toBeGreaterThan(85);
  expect(box!.y + box!.height).toBeLessThan(480);
  await expect(
    page.getByRole("status").filter({ hasText: "Memory note updated" }),
  ).toContainText("saved on this device");
  const record = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("little-world:v1")!).collected.mangwon,
  );
  expect(record.demoDestinationId).toBe("weekend");
  expect(record.provenance).toBe("confirmed-demo");
  await page.reload();
  await page.getByRole("button", { name: /My collection/ }).click();
  await page.getByRole("button", { name: /Mangwon Market picnic/ }).click();
  await expect(page.locator(".memory-quote")).toHaveText(
    "“Our river picnic chapter, saved for another day.”",
  );
});
