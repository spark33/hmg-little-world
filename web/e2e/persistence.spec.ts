import { openBackup } from "./helpers";
import { test, expect, type Page } from "@playwright/test";

const storageKey = "little-world:v1";
async function settings(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await openBackup(page);
  await expect(
    page.getByRole("region", { name: "World backup and recovery" }),
  ).toBeVisible();
}
async function currentSave(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), storageKey);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "roamy:preferences:v1",
      JSON.stringify({
        version: 1,
        night: false,
        muted: true,
        reducedMotion: true,
      }),
    );
  });
});

test("world backup import is previewed and cancelable before a durable replacement", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page);
  await page
    .getByRole("button", { name: "Prepare world backup", exact: true })
    .click();
  const backup = JSON.parse(
    await page
      .getByRole("textbox", { name: "Exported world backup" })
      .inputValue(),
  );
  expect(backup.world.version).toBe(2);
  expect(backup.world.collected.gwangjang.provenance).toBe("illustration");
  backup.world.collected.mangwon = {
    visitDate: "2026-11-15",
    memory: "A confirmed Mangwon demo keepsake",
    provenance: "confirmed-demo",
  };
  const original = await currentSave(page);
  await page
    .getByRole("textbox", { name: "Paste a world backup", exact: true })
    .fill(JSON.stringify(backup));
  await page
    .getByRole("button", { name: "Review imported world", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Confirm world replacement" }),
  ).toContainText("1 memory keepsake");
  expect(await currentSave(page)).toBe(original);
  await page
    .getByRole("button", { name: "Keep current data", exact: true })
    .click();
  expect(await currentSave(page)).toBe(original);
  await page
    .getByRole("button", { name: "Review imported world", exact: true })
    .click();
  await page.screenshot({
    path: `${process.env.EVIDENCE_DIR || "../artifacts/roamy-roadmap"}/backup-replacement.png`,
  });
  await page
    .getByRole("button", { name: "Confirm replace world", exact: true })
    .click();
  expect(JSON.parse((await currentSave(page))!).collected.mangwon.memory).toBe(
    "A confirmed Mangwon demo keepsake",
  );
  await page.reload();
  await settings(page);
  await page
    .getByRole("button", { name: "Prepare world backup", exact: true })
    .click();
  const reloaded = JSON.parse(
    await page
      .getByRole("textbox", { name: "Exported world backup" })
      .inputValue(),
  );
  expect(reloaded.world.collected.mangwon.memory).toBe(
    "A confirmed Mangwon demo keepsake",
  );
});

test("legacy Chicago data is preserved as legacy while the Seoul world is initialized", async ({
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
        visitDate: "2026-11-14",
        memory: "Original Chicago note; never relabel this as Seoul",
      },
    },
  });
  await page.addInitScript(
    (raw) => localStorage.setItem("little-world:v1", raw),
    original,
  );
  await page.goto("/");
  expect(await currentSave(page)).toBe(original);
  await settings(page);
  await page
    .getByRole("button", { name: "Prepare world backup", exact: true })
    .click();
  const backup = JSON.parse(
    await page
      .getByRole("textbox", { name: "Exported world backup" })
      .inputValue(),
  );
  expect(backup.world.collected.chicago).toEqual({
    visitDate: "2026-11-14",
    memory: "Original Chicago note; never relabel this as Seoul",
    provenance: "confirmed-demo",
  });
  expect(backup.world.collected.detroit.provenance).toBe("illustration");
  expect(backup.world.collected.gwangjang.provenance).toBe("illustration");
  expect(await currentSave(page)).toBe(original);
});

test("a failed import save keeps the current world and offers retry without false success", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page);
  await page
    .getByRole("button", { name: "Prepare world backup", exact: true })
    .click();
  const backup = JSON.parse(
    await page
      .getByRole("textbox", { name: "Exported world backup" })
      .inputValue(),
  );
  backup.world.collected.mangwon = {
    visitDate: "2026-11-15",
    provenance: "confirmed-demo",
  };
  const original = await currentSave(page);
  await page
    .getByRole("textbox", { name: "Paste a world backup", exact: true })
    .fill(JSON.stringify(backup));
  await page
    .getByRole("button", { name: "Review imported world", exact: true })
    .click();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "little-world:v1")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      write.call(this, key, value);
    };
    window.addEventListener(
      "enable-test-storage",
      () => {
        Storage.prototype.setItem = write;
      },
      { once: true },
    );
  });
  await page
    .getByRole("button", { name: "Confirm replace world", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Your current world has been kept",
  );
  expect(await currentSave(page)).toBe(original);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("enable-test-storage")),
  );
  await page
    .getByRole("button", { name: "Confirm replace world", exact: true })
    .click();
  expect(
    JSON.parse((await currentSave(page))!).collected.mangwon.provenance,
  ).toBe("confirmed-demo");
});

test("clearing recovery copies is deliberate and retains the active world", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "little-world:recovery:v1",
      JSON.stringify({
        version: 2,
        collected: {
          gwangjang: { visitDate: "2026-11-15", provenance: "illustration" },
        },
      }),
    );
    localStorage.setItem("little-world:preserved:v1", "{");
  });
  await page.goto("/");
  await settings(page);
  await expect(
    page.getByText(
      "Worlds, notes and recovery copies are stored as plain text on this device.",
      { exact: false },
    ),
  ).toBeVisible();
  const original = await currentSave(page);
  await page
    .getByRole("button", { name: "Clear recovery copies", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep current data", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("little-world:preserved:v1"),
    ),
  ).toBe("{");
  await page
    .getByRole("button", { name: "Clear recovery copies", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm clear recovery copies", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => localStorage.getItem("little-world:recovery:v1") || null,
    ),
  ).toBeNull();
  expect(
    await page.evaluate(
      () => localStorage.getItem("little-world:preserved:v1") || null,
    ),
  ).toBeNull();
  expect(await currentSave(page)).toBe(original);
});

test("a delayed file read cannot overwrite newer pasted backup text", async ({
  page,
}) => {
  await page.goto("/");
  await settings(page);
  await page
    .getByRole("button", { name: "Prepare world backup", exact: true })
    .click();
  const exported = await page
    .getByRole("textbox", { name: "Exported world backup" })
    .inputValue();
  await page.evaluate(() => {
    File.prototype.text = () =>
      new Promise<string>((resolve) => {
        window.addEventListener(
          "release-test-file",
          () => resolve("outdated file contents"),
          { once: true },
        );
      });
  });
  await page
    .getByLabel("Or choose a backup file in a supported browser")
    .setInputFiles({
      name: "older.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await page
    .getByRole("textbox", { name: "Paste a world backup", exact: true })
    .fill(exported);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("release-test-file")),
  );
  await expect(
    page.getByRole("textbox", { name: "Paste a world backup", exact: true }),
  ).toHaveValue(exported);
  await page
    .getByRole("button", { name: "Review imported world", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Confirm world replacement" }),
  ).toBeVisible();
});

test("retry after an unreadable startup never overwrites the existing world with fallback seeds", async ({
  page,
}) => {
  const original = JSON.stringify({
    version: 2,
    collected: {
      gwangjang: {
        visitDate: "2026-11-15",
        memory: "An edited Seoul illustration",
        provenance: "illustration",
      },
      mangwon: {
        visitDate: "2026-11-15",
        memory: "A previously saved Mangwon keepsake",
        provenance: "confirmed-demo",
      },
      detroit: {
        visitDate: "2026-06-14",
        memory: "Original Detroit illustration",
        provenance: "illustration",
      },
      chicago: {
        visitDate: "2026-11-14",
        memory: "Original archived Chicago note",
        provenance: "confirmed-demo",
      },
    },
  });
  await page.addInitScript((raw) => {
    localStorage.setItem("little-world:v1", raw);
    const read = Storage.prototype.getItem;
    let readable = false;
    Storage.prototype.getItem = function (key) {
      if (key === "little-world:v1" && !readable)
        throw Error("Storage temporarily unavailable");
      return read.call(this, key);
    };
    window.addEventListener(
      "restore-test-storage-read",
      () => {
        readable = true;
      },
      { once: true },
    );
  }, original);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("session only");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("restore-test-storage-read")),
  );
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  expect(await currentSave(page)).toBe(original);
  await expect(
    page.getByRole("group", { name: "Choose saved world" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore saved world", exact: true })
    .click();
  expect(await currentSave(page)).toBe(original);
  const saved = JSON.parse((await currentSave(page))!);
  expect(saved.collected.mangwon.memory).toBe(
    "A previously saved Mangwon keepsake",
  );
  expect(saved.collected.chicago.memory).toBe("Original archived Chicago note");
  await settings(page);
  await page
    .getByRole("button", { name: "Prepare world backup", exact: true })
    .click();
  const restored = JSON.parse(
    await page
      .getByRole("textbox", { name: "Exported world backup" })
      .inputValue(),
  );
  expect(restored.world.collected.mangwon.memory).toBe(
    "A previously saved Mangwon keepsake",
  );
  expect(restored.world.collected.chicago.memory).toBe(
    "Original archived Chicago note",
  );
});
