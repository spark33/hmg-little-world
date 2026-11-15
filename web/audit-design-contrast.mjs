import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";

const base = process.env.TEST_BASE_URL || "http://localhost:5174";
const output =
  process.env.CONTRAST_REPORT || "/workspace/work/design-contrast-report.json";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const reports = [];
async function inspect(stage) {
  const panel = page.locator("aside");
  const positions = (await panel.count())
    ? await panel.evaluate((el) => [
        0,
        Math.max(0, (el.scrollHeight - el.clientHeight) / 2),
        el.scrollHeight,
      ])
    : [0];
  for (const position of positions) {
    if (await panel.count())
      await panel.evaluate((el, value) => {
        el.scrollTop = value;
      }, position);
    const findings = await page.evaluate(() => {
      const color = (text) => {
        const p = text.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
        return [p[0], p[1], p[2], p[3] ?? 1];
      };
      const blend = (front, back) =>
        front
          .slice(0, 3)
          .map(
            (value, index) => value * front[3] + back[index] * (1 - front[3]),
          );
      const luminance = (rgb) =>
        rgb
          .map((c) => c / 255)
          .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
          .reduce(
            (sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index],
            0,
          );
      const ratio = (first, second) => {
        const [low, high] = [luminance(first), luminance(second)].sort(
          (a, b) => a - b,
        );
        return (high + 0.05) / (low + 0.05);
      };
      const walker = document.createTreeWalker(
        document.querySelector("main"),
        NodeFilter.SHOW_TEXT,
      );
      const result = [];
      while (walker.nextNode()) {
        const node = walker.currentNode,
          element = node.parentElement;
        const text = node.textContent.trim();
        if (
          !text ||
          !element ||
          element.closest("script,style,canvas,[aria-hidden=true]")
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        if (
          center.x < 0 ||
          center.x > innerWidth ||
          center.y < 0 ||
          center.y > innerHeight
        )
          continue;
        const style = getComputedStyle(element);
        if (style.visibility !== "visible") continue;
        let current = element,
          opacity = 1,
          clipped = false;
        const layers = [];
        while (current) {
          const s = getComputedStyle(current),
            b = current.getBoundingClientRect();
          opacity *= Number(s.opacity);
          const contains =
            center.x >= b.left &&
            center.x <= b.right &&
            center.y >= b.top &&
            center.y <= b.bottom;
          if (
            !contains &&
            /auto|scroll|hidden|clip/.test(`${s.overflowX} ${s.overflowY}`)
          )
            clipped = true;
          if (contains) layers.push(color(s.backgroundColor));
          current = current.parentElement;
        }
        if (clipped || opacity < 0.01) continue;
        let background = [255, 255, 255];
        for (const layer of layers.reverse())
          background = blend(layer, background);
        const foreground = color(style.color);
        foreground[3] *= opacity;
        const measured = ratio(blend(foreground, background), background);
        const size = parseFloat(style.fontSize),
          weight = parseFloat(style.fontWeight);
        const required =
          size >= 24 || (size >= 18.666 && weight >= 700) ? 3 : 4.5;
        const exclusion = element.closest("[disabled],[aria-disabled=true]")
          ? "disabled control"
          : element.closest(".postmark")
            ? "decorative repeated postmark ornament"
            : null;
        result.push({
          text: text.slice(0, 120),
          selector: `${element.tagName.toLowerCase()}.${element.className || ""}`,
          ratio: Math.round(measured * 100) / 100,
          required,
          size,
          weight,
          effectiveOpacity: opacity,
          foreground,
          background,
          exclusion,
          fail: !exclusion && measured + 0.001 < required,
        });
      }
      return result;
    });
    reports.push({ stage, scroll: position, findings });
  }
  if (await panel.count())
    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });
}
await page.goto(base);
await inspect("day-start");
await page.getByRole("button", { name: /My collection/ }).click();
await inspect("day-album");
await page.getByRole("button", { name: /Gwangjang Market flavors/ }).click();
await inspect("day-memory");
await page.getByRole("button", { name: "Discover Mangwon Market picnic" }).click();
await inspect("day-discovery");
await page.getByRole("button", { name: "Find a Mangwon picnic" }).click();
await inspect("day-destinations");
await page.getByRole("button", { name: "Let’s go", exact: true }).click();
await inspect("day-journey");
await page.getByRole("button", { name: "Simulate journey" }).click();
await inspect("day-arrival");
await page.getByRole("button", { name: "Not yet", exact: true }).click();
await page.getByRole("button", { name: /My collection/ }).click();
await page
  .getByRole("button", { name: "Browse all keepsakes", exact: true })
  .click();
await inspect("day-browse");
await page.getByRole("button", { name: "Close panel" }).click();
await page.getByRole("button", { name: "Demo settings" }).click();
await page
  .getByRole("button", { name: "Prepare world backup", exact: true })
  .click();
await inspect("day-settings-backup-export");
await page
  .getByRole("textbox", { name: "Paste a world backup", exact: true })
  .fill("invalid backup");
await page
  .getByRole("button", { name: "Review imported world", exact: true })
  .click();
await inspect("day-backup-error");
await page
  .getByRole("button", { name: "Switch to evening", exact: true })
  .click();
await inspect("night-settings-backup");
await page.getByRole("button", { name: "Close panel" }).click();
await inspect("night-start");
await page.getByRole("button", { name: /My collection/ }).click();
await inspect("night-album");
await page.getByRole("button", { name: /Gwangjang Market flavors/ }).click();
await inspect("night-memory");
await page.getByRole("button", { name: "Discover Mangwon Market picnic" }).click();
await inspect("night-discovery");
await page.getByRole("button", { name: "Find a Mangwon picnic" }).click();
await inspect("night-destinations");
await page.getByRole("button", { name: "Let’s go", exact: true }).click();
await inspect("night-journey");
await page.getByRole("button", { name: "Simulate journey" }).click();
await inspect("night-arrival");
await page.getByRole("button", { name: "Not yet", exact: true }).click();
await page.getByRole("button", { name: /My collection/ }).click();
await page
  .getByRole("button", { name: "Browse all keepsakes", exact: true })
  .click();
await inspect("night-browse");
await page.evaluate(() =>
  window.dispatchEvent(
    new CustomEvent("vehicle-safety", {
      detail: { state: "driving", preview: false },
    }),
  ),
);
await expect(page.locator("canvas")).toHaveCount(0);
await inspect("browser-safety-event-test");
await context.close();
const animated = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});
const live = await animated.newPage();
await live.goto(base);
await live
  .getByRole("button", { name: "Find a little adventure", exact: true })
  .click();
await live.getByRole("button", { name: "Find a Mangwon picnic" }).click();
await live.getByRole("button", { name: "Let’s go", exact: true }).click();
await live.getByRole("button", { name: "Simulate journey" }).click();
await live.getByRole("button", { name: "Add to my world" }).click();
await expect(live.locator(".collection-caption")).toBeVisible();
reports.push({
  stage: "actual-timed-reveal",
  metrics: await live
    .locator(".collection-caption")
    .evaluate((el) => ({
      color: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
      fontSize: getComputedStyle(el).fontSize,
      progressColor: getComputedStyle(el.querySelector(".collection-progress"))
        .backgroundColor,
    })),
});
await animated.close();
await browser.close();
const failures = reports.flatMap((r) =>
  (r.findings || [])
    .filter((f) => f.fail)
    .map((f) => ({ stage: r.stage, ...f })),
);
await fs.writeFile(
  output,
  JSON.stringify(
    {
      base,
      method:
        "Computed normal-text/large-text contrast; actual ancestor coverage and effective opacity; sampled panel scroll positions. Canvas pixel colors, native control internals and full WCAG compliance are not established.",
      reports,
      failures,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      output,
      sampledStates: reports.length,
      failures: [
        ...new Map(
          failures.map((f) => [`${f.selector}/${f.text}/${f.ratio}`, f]),
        ).values(),
      ],
      reveal: reports.at(-1),
    },
    null,
    2,
  ),
);
