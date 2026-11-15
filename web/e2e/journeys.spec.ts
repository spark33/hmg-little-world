import { chooseNextChapter } from "./helpers";
import { test, expect } from "@playwright/test";
import { initialState } from "../src/domain";

test("collection separates examples and shows newest saved memory chapters first", async ({
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
    page.getByText("2 memories · 4 inspirations. More chapters await.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Collection/ }).click();
  const confirmed = page.getByRole("region", {
    name: "Saved keepsakes",
    exact: true,
  });
  await expect(confirmed.getByRole("button").first()).toContainText(
    "Bukhansan trail morning",
  );
  await expect(confirmed.getByRole("button").nth(1)).toContainText(
    "Mangwon Market picnic",
  );
  await page.getByRole("tab", { name: "Inspiration", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Outing inspiration" })
      .getByRole("button"),
  ).toHaveCount(4);
  await page
    .getByRole("tab", { name: "Earlier memories", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Earlier memories" }),
  ).toContainText("Chicago");
  await page.getByRole("tab", { name: /^My memories/ }).click();
  await confirmed.getByRole("button").first().click();
  await expect(page.locator(".chosen-stop")).toHaveText(
    "No destination was recorded with this memory.",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected.bukhansan
          .demoDestinationId,
    ),
  ).toBeUndefined();
  await page.locator(".world-back").filter({ hasText: "Collection" }).click();
  await expect(confirmed).toBeVisible();
});

test("illustration gives a named curated pairing and both Back steps preserve collection context", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Collection/ }).click();

  await page.getByRole("button", { name: /Gwangjang Market flavors/ }).click();
  const next = page.getByRole("region", { name: "Curated next chapter" });
  await expect(
    next.getByRole("heading", { name: "Mangwon Market picnic" }),
  ).toBeVisible();
  await expect(next).toContainText("market-food chapter");
  expect(
    await page
      .locator(".memory-quote")
      .evaluate(
        (quote) =>
          quote.compareDocumentPosition(
            document.querySelector(".curated-next")!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
  ).toBeTruthy();
  await expect(page.locator(".panel")).not.toContainText("You’ve explored");
  await page.getByRole("link", { name: /^Explore / }).click();
  await page.locator(".world-back").filter({ hasText: "Back" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Gwangjang Market flavors",
      exact: true,
    }),
  ).toBeVisible();
  await page.locator(".world-back").filter({ hasText: "Collection" }).click();
  await expect(
    page.getByRole("region", { name: "Outing inspiration" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Keepsake categories" })
    .selectOption("Cultural experiences");
  await page.getByRole("button", { name: /Seoul museum afternoon/ }).click();
  await page.locator(".world-back").filter({ hasText: "Back" }).click();
  await expect(
    page.getByRole("combobox", { name: "Keepsake categories" }),
  ).toHaveValue("Cultural experiences");
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
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await chooseNextChapter(page);
  await page
    .getByRole("button", { name: "Choose a place", exact: true })
    .click();
  await page.getByRole("button", { name: /Han River picnic pause/ }).click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page.getByRole("button", { name: "Review memory" }).click();
  await page.getByRole("button", { name: "Keep memory" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Collection/ }).click();
  await page
    .getByRole("region", { name: "Saved keepsakes", exact: true })
    .getByRole("button", { name: /Mangwon Market picnic/ })
    .click();
  await expect(
    page.locator("dd").filter({ hasText: "Han River picnic pause" }),
  ).toContainText("chosen by you");
  await expect(page.locator("dl")).toContainText("date added");
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Memory note" })
    .fill("Our river picnic chapter, saved for another day.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
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
  await page.getByRole("button", { name: /Collection/ }).click();
  await page.getByRole("button", { name: /Mangwon Market picnic/ }).click();
  await expect(page.locator(".memory-quote")).toHaveText(
    "“Our river picnic chapter, saved for another day.”",
  );
});
