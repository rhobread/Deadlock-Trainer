import { expect, test, type Page } from "@playwright/test";

async function openLightweightRange(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      return kind.startsWith("webgl")
        ? null
        : Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
    window.requestAnimationFrame = (callback) =>
      window.setTimeout(() => callback(performance.now()), 4);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });
  await page.clock.install({ time: new Date("2026-11-15T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-15T12:01:00Z"));
  await page.goto("/");
  await page.locator('[data-mode="aim"]').click();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#arena")).toHaveClass(/is-running/);
}

test("mouse movement is batched rather than rendering for every event", async ({
  page,
}) => {
  await openLightweightRange(page);
  const before = await page
    .locator("#crosshair")
    .evaluate((element) => element.style.left);
  await page.locator("#arena").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    for (let i = 0; i < 100; i++) {
      element.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: bounds.left + 40 + i,
          clientY: bounds.top + 200,
          pointerType: "mouse",
        }),
      );
    }
  });
  await expect(page.locator("#crosshair")).toHaveCSS("left", before);
  await page.clock.runFor(20);
  const after = await page
    .locator("#crosshair")
    .evaluate((element) => element.style.left);
  expect(after).not.toEqual(before);
});

test("a high-refresh input loop keeps continuous range draws at sixty per second", async ({
  page,
}) => {
  await openLightweightRange(page);
  await page.locator("#soul").evaluate((element) => {
    let lastTop = element.style.top;
    let draws = 0;
    element.dataset.draws = "0";
    new MutationObserver(() => {
      if (element.style.top !== lastTop) {
        lastTop = element.style.top;
        element.dataset.draws = String(++draws);
      }
    }).observe(element, { attributes: true, attributeFilter: ["style"] });
  });
  await page.clock.runFor(1000);
  const draws = Number(await page.locator("#soul").getAttribute("data-draws"));
  expect(draws).toBeGreaterThanOrEqual(55);
  expect(draws).toBeLessThanOrEqual(61);
  await page.keyboard.press("Escape");
  const paused = await page.locator("#soul").getAttribute("data-draws");
  await page.clock.runFor(1000);
  await expect(page.locator("#soul")).toHaveAttribute("data-draws", paused!);
});
