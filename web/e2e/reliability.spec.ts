import { chooseNextChapter } from "./helpers";
import { test, expect } from "@playwright/test";

for (const interruption of ["safety", "close", "background"] as const) {
  test(`a delayed navigation response cannot reopen a journey after ${interruption}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.NativeBridge = {
        onmessage: null,
        postMessage: (raw) => sessionStorage.setItem("pending-navigation", raw),
      };
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Discover" }).click();
    await chooseNextChapter(page);
    await page.getByRole("button", { name: "Choose a place" }).click();
    await page.getByRole("button", { name: "Let’s go", exact: true }).click();
    await expect(page.getByText("Checking navigation…")).toBeVisible();
    if (interruption === "close") {
      await page.getByRole("button", { name: "Close panel" }).click();
    } else if (interruption === "safety") {
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("vehicle-safety", {
            detail: { state: "driving", preview: false },
          }),
        ),
      );
      await expect(page.locator("canvas")).toHaveCount(0);
    } else {
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.locator("canvas")).toHaveCount(0);
    }
    await page.evaluate(() => {
      const request = JSON.parse(sessionStorage.getItem("pending-navigation")!);
      window.NativeBridge?.onmessage?.({
        data: JSON.stringify({ v: 1, id: request.id, available: true }),
      } as MessageEvent);
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(
        new CustomEvent("vehicle-safety", {
          detail: { state: "unknown", preview: true },
        }),
      );
    });
    await page.waitForTimeout(1900); // Includes the original native-response timeout.
    await expect(page.getByRole("complementary")).toHaveCount(0);
    await expect(
      page.getByText("Navigation requested", { exact: true }),
    ).toHaveCount(0);
    // Cancellation releases the pending state so the flow can be used again.
    await page.getByRole("button", { name: "Discover" }).click();
    await chooseNextChapter(page);
    await page.getByRole("button", { name: "Choose a place" }).click();
    await expect(
      page.getByRole("button", { name: "Let’s go", exact: true }),
    ).toBeEnabled();
  });
}

for (const raw of ["{", '{"version":3,"collected":{"future":{"value":42}}}']) {
  test(`preserves an unreadable save (${raw === "{" ? "corrupt" : "future version"}) until explicit reset`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("little-world:v1", value),
      raw,
    );
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText(
      "It has been preserved",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("little-world:v1")),
    ).toBe(raw);
    await page.getByRole("button", { name: "Review save" }).click();
    await page.getByRole("button", { name: "Memories", exact: true }).click();
    await page.getByRole("button", { name: "Reset my world" }).click();
    await page.getByRole("button", { name: "Keep my world" }).click();
    expect(
      await page.evaluate(() => localStorage.getItem("little-world:v1")),
    ).toBe(raw);
    await page.getByRole("button", { name: "Memories", exact: true }).click();
    await page.getByRole("button", { name: "Reset my world" }).click();
    await page
      .getByRole("button", { name: "Confirm reset", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("little-world:v1")!).version,
      ),
    ).toBe(2);
  });
}

test("failed storage shows a visible warning and can be retried", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    window.addEventListener(
      "enable-test-storage",
      () => {
        Storage.prototype.setItem = original;
      },
      { once: true },
    );
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("session only");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("enable-test-storage")),
  );
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Object.keys(
        JSON.parse(localStorage.getItem("little-world:v1")!).collected,
      ),
    ),
  ).toHaveLength(4);
});
