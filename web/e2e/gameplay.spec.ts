import { chooseNextChapter } from "./helpers";
import { test, expect } from "@playwright/test";

test("all four new keepsakes are playable, persistent, and reach a complete collection", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const adventures = [
    ["Mangwon Market picnic", "Choose a place"],
    ["Gyeongbokgung palace walk", "Choose a place"],
    ["Bukhansan trail morning", "Choose a place"],
    ["Seoul museum afternoon", "Choose a place"],
  ];
  for (const [index, [title, action]] of adventures.entries()) {
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    await chooseNextChapter(page);
    await expect(
      page.getByRole("heading", { name: title, exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(
      page.getByText("Outing ideas. Check place details before heading out."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Let’s go", exact: true }).click();
    await expect(
      page.getByText("Navigation is unavailable for this destination."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review memory" }).click();
    await page.getByRole("button", { name: "Keep memory" }).click();
    await expect(
      page.getByText("Your little world just got bigger!", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(
        `${index + 1} ${index === 0 ? "memory" : "memories"} · 4 inspirations. ${index === 3 ? "This collection is complete." : "More chapters await."}`,
        { exact: true },
      ),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Revisit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".car-shelf .shelf-item")).toHaveCount(4);
  const records = await page.evaluate(
    () => JSON.parse(localStorage.getItem("little-world:v1")!).collected,
  );
  expect(Object.keys(records)).toHaveLength(8);
  expect(records["gyeongbokgung"].provenance).toBe("confirmed-demo");
  expect(records.bukhansan.provenance).toBe("confirmed-demo");
  expect(records["seoul-museum"].provenance).toBe("confirmed-demo");
});

test("category browsing and memory recommendations open their own adventure", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Collection/ }).click();
  await page.getByRole("button", { name: /Seokchon Lake blossoms/ }).click();
  await page.getByRole("link", { name: /^Explore / }).click();
  await expect(
    page.getByRole("button", { name: "Choose a place" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Keepsake categories" })
    .selectOption("Cultural experiences");
  await expect(
    page.getByRole("button", { name: /Seoul museum afternoon/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Gyeongbokgung palace walk/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Seoul museum afternoon/ }).click();
  await expect(
    page.getByRole("button", { name: "Choose a place" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose a place" }).click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page.getByRole("button", { name: "Review memory" }).click();
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected[
          "seoul-museum"
        ],
    ),
  ).toBeUndefined();
});

test("memory notes can be canceled, edited, and reloaded without changing their source", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Collection/ }).click();
  await page.getByRole("button", { name: /Gwangjang Market flavors/ }).click();
  await expect(
    page.getByText("Regional foods · OUTING INSPIRATION"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit note" }).click();
  await page
    .getByRole("textbox", { name: "Memory note" })
    .fill("Canceled note");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByText("A market afternoon full of little discoveries.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit note" }).click();
  await page
    .getByRole("textbox", { name: "Memory note" })
    .fill("Our favorite market afternoon together.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /Collection/ }).click();
  await page.getByRole("button", { name: /Gwangjang Market flavors/ }).click();
  await expect(
    page.getByText("Our favorite market afternoon together.", { exact: false }),
  ).toBeVisible();
  const record = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("little-world:v1")!).collected.gwangjang,
  );
  expect(record.provenance).toBe("illustration");
  expect(record.visitDate).toBe("2026-06-14");
});

test("an earlier Chicago confirmation stays in the archive and never becomes a Seoul visit", async ({
  page,
}) => {
  const original = JSON.stringify({
    version: 1,
    collected: {
      detroit: {
        visitDate: "2026-06-14",
        memory: "Original Detroit illustration",
      },
      chicago: {
        visitDate: "2026-08-01",
        memory: "Our original Chicago confirmation",
      },
    },
  });
  await page.addInitScript((raw) => {
    if (!sessionStorage.getItem("legacy-fixture-set")) {
      localStorage.setItem("little-world:v1", raw);
      sessionStorage.setItem("legacy-fixture-set", "true");
    }
  }, original);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByText("0 memories · 4 inspirations. More chapters await."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("little-world:v1")),
  ).toBe(original);
  await page.getByRole("button", { name: /Collection/ }).click();
  await page
    .getByRole("tab", { name: "Earlier memories", exact: true })
    .click();
  const archive = page.getByRole("region", { name: "Earlier memories" });
  await expect(archive.getByRole("button")).toHaveCount(2);
  await archive
    .getByRole("button", { name: /Chicago deep-dish pizza/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chicago deep-dish pizza", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Our original Chicago confirmation", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("From your earlier collection.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await chooseNextChapter(page);
  await expect(
    page.getByRole("button", { name: "Choose a place" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose a place" }).click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page.getByRole("button", { name: "Review memory" }).click();
  await page.getByRole("button", { name: "Keep memory" }).click();
  await page.reload();
  await expect(
    page.getByText("1 memory · 4 inspirations. More chapters await."),
  ).toBeVisible();
  const records = await page.evaluate(
    () => JSON.parse(localStorage.getItem("little-world:v1")!).collected,
  );
  expect(records.chicago).toMatchObject({
    memory: "Our original Chicago confirmation",
    visitDate: "2026-08-01",
    provenance: "confirmed-demo",
  });
  expect(records.mangwon.provenance).toBe("confirmed-demo");
  expect(Object.keys(records)).toHaveLength(7);
});

test("Seoul confirmations use the device's calendar date across the UTC boundary", async ({
  browser,
}) => {
  const context = await browser.newContext({
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-11-15T15:30:00Z"));
  await page.goto("/");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await chooseNextChapter(page);
  await page
    .getByRole("button", { name: "Choose a place", exact: true })
    .click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page
    .getByRole("button", { name: "Review memory", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep memory", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected.mangwon
          .visitDate,
    ),
  ).toBe("2026-11-16");
  await context.close();
});

test("a collected Seoul adventure can be replayed without duplicating or rewriting the memory", async ({
  page,
}) => {
  const original = JSON.stringify({
    version: 2,
    collected: {
      mangwon: {
        visitDate: "2026-11-15",
        memory: "Our first market picnic",
        provenance: "confirmed-demo",
      },
    },
  });
  await page.addInitScript(
    (raw) => localStorage.setItem("little-world:v1", raw),
    original,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Collection/ }).click();
  await page.getByRole("button", { name: /Mangwon Market picnic/ }).click();
  await page.getByRole("button", { name: "Revisit", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose a place", exact: true })
    .click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page
    .getByRole("button", { name: "Review memory", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Keep memory", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View memory", exact: true }).click();
  await expect(
    page.getByText("Our first market picnic", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("little-world:v1")),
  ).toBe(original);
});

test("a successful explicit reset resolves an unreadable startup before the next confirmed save", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem;
    const write = Storage.prototype.setItem;
    if (!read.call(sessionStorage, "reset-read-fixture")) {
      write.call(
        localStorage,
        "little-world:v1",
        JSON.stringify({
          version: 2,
          collected: {
            chicago: {
              visitDate: "2026-08-01",
              memory: "Archived Chicago note",
              provenance: "confirmed-demo",
            },
          },
        }),
      );
      write.call(sessionStorage, "reset-read-fixture", "true");
    }
    Storage.prototype.getItem = function (key) {
      if (
        this === localStorage &&
        key === "little-world:v1" &&
        !read.call(sessionStorage, "world-reads-ready")
      )
        throw new DOMException("Temporarily unreadable", "SecurityError");
      return read.call(this, key);
    };
    window.addEventListener("restore-world-reads", () =>
      write.call(sessionStorage, "world-reads-ready", "true"),
    );
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Saved world could not be read",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("restore-world-reads")),
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Memories", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset my world", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm reset", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await chooseNextChapter(page);
  await page
    .getByRole("button", { name: "Choose a place", exact: true })
    .click();
  await page.getByRole("button", { name: "Let’s go", exact: true }).click();
  await page
    .getByRole("button", { name: "Review memory", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep memory", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-world:v1")!).collected.mangwon
          .provenance,
    ),
  ).toBe("confirmed-demo");
  await page.reload();
  await expect(
    page.getByText("1 memory · 4 inspirations. More chapters await.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
