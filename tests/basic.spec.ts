import { expect, test, type Page } from "@playwright/test";

async function openBasic(
  page: Page,
  mode?: string,
  bindings: Record<string, string> = {},
) {
  await page.addInitScript(
    ({ mode, bindings }) => {
      if (mode && !localStorage.getItem("deadlock-trainer-v1")) {
        localStorage.setItem(
          "deadlock-trainer-v1",
          JSON.stringify({ settings: { mode, bindings } }),
        );
      }
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...args: unknown[]
      ) {
        if (kind.startsWith("webgl")) {
          document.documentElement.dataset.webglRequests = String(
            Number(document.documentElement.dataset.webglRequests || "0") + 1,
          );
          return null;
        }
        return Reflect.apply(original, this, [kind, ...args]);
      } as typeof original;
    },
    { mode, bindings },
  );
  await page.clock.install({ time: new Date("2026-11-16T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-16T12:01:00Z"));
  await page.goto("/");
}

async function start(page: Page) {
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#arena")).toHaveClass(/is-running/);
}

async function clickTarget(page: Page) {
  await page
    .getByRole("button", { name: "Click practice target", exact: true })
    .click();
}

test.afterEach(async ({ page }) => {
  expect((await page.pageErrors()).map((error) => error.message)).toEqual([]);
});

test("basic key prompts load no 3D code and leave every existing mode available", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await openBasic(page);
  await expect(
    page.getByRole("heading", { name: "Basic keybinds." }),
  ).toBeVisible();
  for (const name of [
    "Basic keybinds",
    "Basic click targets",
    "Basic mixed practice",
    "Keybind recall",
    "Soul practice",
    "Combat range",
  ]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page
    .getByLabel("PRACTICE FOCUS", { exact: true })
    .selectOption("abilities");
  await start(page);
  await page.keyboard.press(await page.locator("#key-hint kbd").innerText());
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await expect(page.locator("#range-hud")).toBeHidden();
  await expect(page.locator("#range-canvas")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.webglRequests || "0",
    ),
  ).toBe("0");
  expect(
    requested.filter((url) =>
      /\/src\/range\.ts|\/assets\/range-|\/deps\/three/.test(url),
    ),
  ).toEqual([]);
});

test("basic click targets are stationary, accept rapid clicks, and need no reload", async ({
  page,
}) => {
  await openBasic(page, "basic-aim");
  await start(page);
  const target = page.getByRole("button", {
    name: "Click practice target",
    exact: true,
  });
  const top = await target.evaluate((element) => element.style.top);
  await page.clock.runFor(1000);
  await expect(target).toHaveCSS("top", top);
  await page.locator("#arena").click({ position: { x: 8, y: 200 } });
  for (let i = 0; i < 14; i++) await clickTarget(page);
  await expect(page.locator("#stat-hits")).toHaveText("14");
  await expect(page.locator("#stat-accuracy")).toHaveText("93%");
  await expect(page.locator("#range-hud")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.webglRequests || "0",
    ),
  ).toBe("0");
});

test("basic mixed practice alternates single keys and clicks and saves separately", async ({
  page,
}) => {
  await openBasic(page, "basic-mixed");
  await page
    .getByLabel("PRACTICE FOCUS", { exact: true })
    .selectOption("abilities");
  await start(page);
  await page.keyboard.press(await page.locator("#key-hint kbd").innerText());
  await clickTarget(page);
  await expect(page.locator("#practice-screen")).toBeVisible();
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish session early" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Basic mixed practice", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#last-session")).toContainText("100% accuracy");
  await expect(page.getByLabel("PRACTICE FOCUS", { exact: true })).toHaveValue(
    "abilities",
  );
});

test("basic clicks do not turn into automatic fire while the mouse is held", async ({
  page,
}) => {
  await openBasic(page, "basic-aim");
  await start(page);
  const box = await page.locator("#soul").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.clock.runFor(500);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.mouse.up();
  await page.keyboard.press("Escape");
  const remaining = await page.locator("#stat-time").innerText();
  await page.clock.runFor(5000);
  await expect(page.locator("#stat-time")).toHaveText(remaining);
  await page.getByRole("button", { name: "Resume training" }).click();
  await clickTarget(page);
  await expect(page.locator("#stat-hits")).toHaveText("02");
});

test("basic manual can hide hints and use the saved mouse button bindings", async ({
  page,
}) => {
  const bindings = Object.fromEntries(
    ["AbilityMelee", "HeldItem", "Attack", "ADS", "Reload", "Interact"].map(
      (id) => [id, "MOUSE2"],
    ),
  );
  await openBasic(page, "basic-keys", bindings);
  await page
    .getByLabel("PRACTICE FOCUS", { exact: true })
    .selectOption("combat");
  await page.getByRole("switch", { name: "Show key hints" }).uncheck();
  await start(page);
  await expect(page.locator("#key-hint")).toHaveText("TRUST YOUR HANDS");
  await page
    .locator("#arena")
    .click({ position: { x: 100, y: 250 }, button: "right" });
  await expect(page.locator("#stat-hits")).toHaveText("01");
});

test("the 3D combat drills still start on demand and basic mode can be revisited", async ({
  page,
}) => {
  await openBasic(page, "mixed");
  await expect(
    page.getByRole("heading", { name: "Combat range." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.webglRequests || "0",
    ),
  ).toBe("0");
  await page
    .getByLabel("LANE SITUATION", { exact: true })
    .selectOption("heavy-melee");
  await start(page);
  expect(
    Number(
      await page.evaluate(() => document.documentElement.dataset.webglRequests),
    ),
  ).toBeGreaterThan(0);
  await expect(page.locator("#range-status")).toContainText("2D FALLBACK");
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(550);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.keyboard.up("KeyQ");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish session early" }).click();
  await page
    .getByRole("button", { name: "Basic click targets", exact: true })
    .click();
  const requests = await page.evaluate(
    () => document.documentElement.dataset.webglRequests,
  );
  await start(page);
  await clickTarget(page);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  expect(
    await page.evaluate(() => document.documentElement.dataset.webglRequests),
  ).toBe(requests);
});

test("basic mode layout fits desktop and mobile screens", async ({ page }) => {
  await openBasic(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({
    path: `test-results/basic-${test.info().project.name}.png`,
    fullPage: true,
  });
});
