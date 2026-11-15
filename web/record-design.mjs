import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createHash } from "node:crypto";

// Interactive recorder: inspect each returned PNG, then explicitly accept it
// before the next state can be recorded. All completion uses the real UI.
const base = process.env.TEST_BASE_URL || "http://localhost:5174";
const output = path.resolve(
  process.env.DESIGN_EVIDENCE_DIR || "../artifacts/roamy-seoul/design",
);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
let context;
let page;
let run;
let started;
let steps = [];
let observations = [];
let productionAssets = [];
let bundledNotices;
let backupText = "";
const errors = [];
const manifest = () => ({
  run,
  base,
  viewport: page?.viewportSize(),
  started,
  browser: browser.version(),
  environment: "Cloud Chromium; software WebGL; browser development preview",
  videoAudio: "Playwright screen recording has no audio track",
  completionMethod:
    "UI interaction only; no injected completed world or fabricated parked signal",
  safetyTestMethod:
    run === "narrow"
      ? "Restrictive browser driving event only; never PARKED; not native Pleos runtime evidence"
      : "No safety state injected",
  steps,
  productionAssets,
  bundledNotices,
  observations,
  errors,
});
async function save() {
  await fs.writeFile(
    path.join(output, `${run}-manifest.json`),
    JSON.stringify(manifest(), null, 2) + "\n",
  );
}
async function observe(action) {
  const buttons = await page
    .getByRole("button")
    .evaluateAll((elements) =>
      elements
        .filter((el) => el.getClientRects().length)
        .map((el) => el.getAttribute("aria-label") || el.textContent?.trim()),
    );
  observations.push({
    action,
    seconds: (Date.now() - started) / 1000,
    buttons,
  });
}
async function click(name) {
  await observe(`before clicking ${String(name)}`);
  const control = page.getByRole("button", {
    name,
    exact: typeof name === "string",
  });
  await expect(control).toHaveCount(1);
  await expect(control).toBeEnabled();
  await control.click();
}
async function screenshot(name, description) {
  const panel = page.locator("aside.panel");
  if (await panel.count()) {
    await panel.evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    await expect(panel).toHaveCSS("opacity", "1");
  }
  // Wait for painted frames rather than assuming a short wall-clock delay is
  // enough while Chromium renders WebGL and records video in software.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.waitForTimeout(250);
  const index = String(steps.length + 1).padStart(2, "0");
  const filename = `${run}-${index}-${name}.png`;
  await page.screenshot({ path: path.join(output, filename), fullPage: false });
  steps.push({
    number: steps.length + 1,
    name,
    description,
    file: filename,
    videoSeconds: (Date.now() - started) / 1000,
    dom: await page.locator("main").innerText(),
    accepted: false,
  });
  await save();
  console.log(
    JSON.stringify({
      screenshot: path.join(output, filename),
      step: steps.at(-1),
    }),
  );
}
async function begin(name, width, height, reducedMotion) {
  if (context)
    throw Error("Finish the active recording before starting another.");
  run = name;
  started = Date.now();
  steps = [];
  observations = [];
  errors.length = 0;
  context = await browser.newContext({
    viewport: { width, height },
    reducedMotion,
    recordVideo: {
      dir: path.join(output, "raw-video"),
      size: { width, height },
    },
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByText("4 memories made. So many more to come.", { exact: true }),
  ).toHaveText("4 memories made. So many more to come.");
  await expect(page.getByRole("button", { name: /My collection/ })).toContainText("4");
  await page.waitForTimeout(2000);
  const assets = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/assets/")),
  );
  productionAssets = await Promise.all(
    [...new Set(assets)].map(async (url) => {
      const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
      return {
        url,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
  const noticeUrl = new URL("third-party-notices.txt", base).href;
  const response = await fetch(noticeUrl);
  if (!response.ok) throw Error("The production license notice is not ready.");
  const noticeBytes = Buffer.from(await response.arrayBuffer());
  bundledNotices = {
    url: noticeUrl,
    bytes: noticeBytes.length,
    sha256: createHash("sha256").update(noticeBytes).digest("hex"),
  };
}
async function browse() {
  if (
    await page.getByRole("button", { name: "Close panel", exact: true }).count()
  )
    await click("Close panel");
  await click(/My collection/);
  await click("Browse all keepsakes");
  await expect(
    page.getByRole("group", { name: "Keepsake categories" }),
  ).toBeVisible();
}
async function collect(title, find, expectedCount) {
  await browse();
  await click(new RegExp(title));
  await click(find);
  await expect(
    page.getByText("Illustrative venues. No live availability or route data."),
  ).toBeVisible();
  await click("Let’s go");
  await expect(
    page.getByText(
      "Live navigation is unavailable. This is a sample destination.",
    ),
  ).toBeVisible();
  await page.waitForTimeout(650);
  await click("Simulate journey");
  await page.waitForTimeout(650);
  await click("Add to my world");
  const since = Date.now();
  await expect(
    page.getByText("A little memory is finding its home…"),
  ).toBeVisible();
  await expect(
    page.getByText("Your little world just got bigger!", { exact: false }),
  ).toBeVisible({ timeout: 20000 });
  if (Date.now() - since < 6500)
    throw Error("The real seven-second reveal was unexpectedly skipped.");
  const count = await page.evaluate(
    () =>
      Object.keys(JSON.parse(localStorage.getItem("little-world:v1")).collected)
        .length,
  );
  if (count !== expectedCount)
    throw Error(
      `Expected ${expectedCount} actual UI-confirmed records; got ${count}`,
    );
}
async function command(input) {
  const { action, note, health } = input;
  if (action === "accept") {
    const current = steps.at(-1);
    if (!current || current.accepted) throw Error("No unaccepted screenshot.");
    current.accepted = true;
    current.health = health || "healthy";
    current.inspectionNote = note;
    await save();
    return;
  }
  if (steps.at(-1)?.accepted === false)
    throw Error("Inspect and accept the latest screenshot before advancing.");
  switch (action) {
    case "main-start":
      await begin("main", 1440, 900, "no-preference");
      await screenshot(
        "clean-start",
        "Four clearly illustrative Seoul memories in a clean browser context.",
      );
      break;
    case "album":
      await click(/My collection/);
      await screenshot(
        "collection",
        "Accessible collection presents the four seeded Seoul illustrations.",
      );
      break;
    case "gwangjang":
      await click(/Gwangjang Market flavors/);
      await screenshot(
        "gwangjang-memory",
        "Memory details disclose illustrative provenance and suggest a related keepsake.",
      );
      break;
    case "discover-mangwon":
      await click("Meet your next keepsake");
      await screenshot(
        "mangwon-discovery",
        "Mangwon picnic preview offers an explicit next adventure.",
      );
      break;
    case "destinations":
      await click("Find a Mangwon picnic");
      await screenshot(
        "sample-destinations",
        "The three destinations and distances are explicitly illustrative.",
      );
      break;
    case "journey":
      await click("Let’s go");
      await expect(
        page.getByText(
          "Live navigation is unavailable. This is a sample destination.",
        ),
      ).toBeVisible();
      await screenshot(
        "navigation-unavailable",
        "Real navigation is honestly unavailable; simulation is a separate deliberate action.",
      );
      break;
    case "arrival":
      await click("Simulate journey");
      await screenshot(
        "explicit-confirmation",
        "A simulated arrival asks whether to add the keepsake; confirmation has not yet saved it.",
      );
      break;
    case "reveal":
      await click("Add to my world");
      await expect(
        page.getByText("A little memory is finding its home…"),
      ).toBeVisible();
      await page.waitForTimeout(2800);
      await screenshot(
        "seven-second-reveal",
        "The real timed reveal is captured midway after a durable confirmation.",
      );
      break;
    case "collected":
      await expect(
        page.getByText("Your little world just got bigger!", { exact: false }),
      ).toBeVisible({ timeout: 20000 });
      await screenshot(
        "mangwon-collected",
        "The fifth memory has a home and the product confirms completion.",
      );
      break;
    case "browse":
      await browse();
      await screenshot(
        "browse-all",
        "All eight Seoul keepsakes and category filters are discoverable in the collection browser.",
      );
      break;
    case "palace":
      await collect("Gyeongbokgung palace walk", "Find a palace walk", 6);
      await screenshot(
        "palace-collected",
        "A real UI-confirmed palace demonstration adds its own asset after the full reveal.",
      );
      break;
    case "mountain":
      await collect("Bukhansan trail morning", "Find a Bukhansan trail", 7);
      await screenshot(
        "bukhansan-collected",
        "The Bukhansan demonstration adds a distinct mountain keepsake.",
      );
      break;
    case "museum":
      await collect("Seoul museum afternoon", "Find a Seoul art adventure", 8);
      await screenshot(
        "museum-collected",
        "The fourth newly confirmed demonstration completes the eight-keepsake world.",
      );
      break;
    case "completion":
      await browse();
      await expect(
        page.getByText("Your demo collection is complete.", { exact: true }),
      ).toBeVisible();
      await screenshot(
        "complete-collection",
        "Completion and a four-of-four progress bar are reached solely through actual UI interaction.",
      );
      break;
    case "short-start":
      await begin("short", 960, 480, "reduce");
      await screenshot(
        "short-start",
        "Short landscape layout in the system reduced-motion setting.",
      );
      break;
    case "short-edit":
      await click(/My collection/);
      await click(/Gwangjang Market flavors/);
      await click("Edit memory note");
      await page
        .getByRole("textbox", { name: "Memory note", exact: true })
        .fill("A quiet Seoul market afternoon.");
      await page
        .getByRole("button", { name: "Save memory", exact: true })
        .focus();
      await expect(page.locator(".panel > .primary")).toHaveCount(0);
      await screenshot(
        "memory-edit",
        "The local note editor keeps Save and Cancel separate from discovery actions.",
      );
      break;
    case "short-saved":
      await click("Save memory");
      await expect(
        page.getByText("A quiet Seoul market afternoon.", { exact: false }),
      ).toBeVisible();
      await screenshot(
        "edited-memory",
        "The saved note remains attached to the original illustrative memory.",
      );
      break;
    case "short-export":
      await click("Close panel");
      await click("Demo settings");
      await click("Prepare world backup");
      backupText = await page
        .getByRole("textbox", { name: "Exported world backup" })
        .inputValue();
      await page
        .getByRole("textbox", { name: "Exported world backup" })
        .focus();
      await screenshot(
        "backup-export",
        "The complete plain-text backup is available without a native file-download dependency.",
      );
      break;
    case "short-reset-review":
      await click("Reset demo world");
      await page
        .getByRole("button", { name: "Confirm reset", exact: true })
        .focus();
      await screenshot(
        "reset-review",
        "Reset requires an explicit second action before replacing the active world.",
      );
      break;
    case "short-recovery-review":
      await click("Confirm reset");
      await click("Demo settings");
      await click("Review recovery copy");
      await expect(
        page.getByRole("group", { name: "Confirm world replacement" }),
      ).toBeVisible();
      await screenshot(
        "recovery-review",
        "A real prior save is previewed before recovery; no data has been restored yet.",
      );
      break;
    case "short-restored":
      await click("Confirm replace world");
      await click(/My collection/);
      await click(/Gwangjang Market flavors/);
      await expect(
        page.getByText("A quiet Seoul market afternoon.", { exact: false }),
      ).toBeVisible();
      await screenshot(
        "restored-note",
        "The user-authored note survives reset followed by deliberate recovery.",
      );
      break;
    case "short-night":
      await click("Close panel");
      await click("Demo settings");
      await click("Switch to evening");
      await click("Close panel");
      await screenshot(
        "evening",
        "The evening world keeps the same Seoul palette while text sits on opaque readable surfaces.",
      );
      break;
    case "short-licenses":
      await click("Demo settings");
      await observe("before opening bundled open-source licenses");
      await page.getByText("Open-source licenses", { exact: true }).click();
      await expect(
        page.getByLabel("Bundled open-source license text"),
      ).toContainText("License");
      await page.getByLabel("Bundled open-source license text").focus();
      await screenshot(
        "bundled-licenses",
        "Bundled third-party license text is readable inside Settings without leaving the application.",
      );
      break;
    case "narrow-start":
      await begin("narrow", 360, 480, "reduce");
      await click("Demo settings");
      await click("Switch to evening");
      await click("Close panel");
      await screenshot(
        "narrow-evening",
        "The narrow preview disclosure remains visible on its own dark header surface.",
      );
      break;
    case "narrow-backup-error":
      await click("Demo settings");
      await page
        .getByRole("textbox", { name: "Paste a world backup", exact: true })
        .fill("This is not a world backup.");
      await click("Review imported world");
      await expect(page.locator(".backup-feedback[role=alert]")).toBeVisible();
      await page
        .locator(".backup-feedback[role=alert]")
        .scrollIntoViewIfNeeded();
      await screenshot(
        "invalid-backup",
        "Malformed backup text produces a readable error and keeps the active world unchanged.",
      );
      break;
    case "narrow-import-review":
      await click("Prepare world backup");
      backupText = await page
        .getByRole("textbox", { name: "Exported world backup" })
        .inputValue();
      await page
        .getByRole("textbox", { name: "Paste a world backup", exact: true })
        .fill(backupText);
      await click("Review imported world");
      await expect(
        page.getByRole("group", { name: "Confirm world replacement" }),
      ).toBeVisible();
      await screenshot(
        "import-review",
        "The corrected backup is parsed and previewed; replacement remains cancelable.",
      );
      break;
    case "narrow-cancelled":
      await click("Keep current data");
      await click("Close panel");
      await screenshot(
        "import-cancelled",
        "Canceling backup replacement leaves all four original illustrations in the world.",
      );
      break;
    case "narrow-safety":
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("vehicle-safety", {
            detail: { state: "driving", preview: false },
          }),
        ),
      );
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect(page.getByRole("button")).toHaveCount(0);
      await screenshot(
        "browser-safety-test",
        "A clearly scoped browser safety-event test removes the Canvas and interactive controls; this is not native Pleos runtime evidence.",
      );
      break;
    case "finish": {
      const video = page.video();
      const saved = await page.evaluate(() =>
        localStorage.getItem("little-world:v1"),
      );
      await context.close();
      await video.saveAs(path.join(output, `${run}-walkthrough.webm`));
      await video.delete();
      await fs.writeFile(
        path.join(output, `${run}-final-save.json`),
        saved + "\n",
      );
      await save();
      context = null;
      page = null;
      console.log(
        JSON.stringify({
          finished: run,
          video: path.join(output, `${run}-walkthrough.webm`),
          steps: steps.length,
          errors,
        }),
      );
      break;
    }
    case "quit":
      if (context) throw Error("Finish the current recording first.");
      await browser.close();
      process.exit(0);
    default:
      throw Error(`Unknown action: ${action}`);
  }
}
const lines = readline.createInterface({ input: process.stdin });
console.log(JSON.stringify({ ready: true, base, output }));
for await (const line of lines) {
  if (!line.trim()) continue;
  try {
    await command(JSON.parse(line));
  } catch (error) {
    console.log(JSON.stringify({ error: String(error), run }));
  }
}
if (context) await context.close();
await browser.close();
