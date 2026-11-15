import { test, expect, type Page } from "@playwright/test";

async function pressPrompt(page: Page) {
  const key = await page.locator("#key-hint kbd").innerText();
  const codes: Record<string, string> = {
    Space: "Space",
    Shift: "Shift",
    Ctrl: "Control",
    Control: "Control",
    Alt: "Alt",
  };
  await page.keyboard.press(codes[key] || key);
}

test("setup, recall, pause, resume, results, and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Keybind recall." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "30s", exact: true }).click();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#practice-screen")).toBeVisible();
  await pressPrompt(page);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "On your time." }),
  ).toBeVisible();
  const pausedTime = await page.locator("#stat-time").innerText();
  await page.waitForTimeout(1200);
  await expect(page.locator("#stat-time")).toHaveText(pausedTime);
  await page.getByRole("button", { name: "Resume training" }).click();
  await pressPrompt(page);
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish session early" }).click();
  await expect(page.locator("#result-accuracy")).toHaveText("100%");
  await page.reload();
  await expect(page.locator("#last-session")).toContainText("100% accuracy");
  await expect(
    page.getByRole("button", { name: "30s", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("wrong keys, hidden hints, and automatic time limit", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "30s", exact: true }).click();
  await page.getByRole("switch", { name: "Show key hints" }).uncheck();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#key-hint")).toHaveText("TRUST YOUR HANDS");
  await page.keyboard.press("k");
  await expect(page.locator("#stat-accuracy")).toHaveText("0%");
  await page.clock.runFor(30_100);
  await expect(page.getByRole("heading", { name: "Nice work." })).toBeVisible();
  await expect(page.locator("#stat-time")).toHaveText("00:00");
});

test("aim scores targets and misses; mixed alternates input types", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="aim"]').click();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#soul")).toBeVisible();
  await page.locator("#arena").click({ position: { x: 8, y: 8 } });
  await expect(page.locator("#stat-accuracy")).toHaveText("0%");
  await page.getByRole("button", { name: "Shoot soul target" }).click();
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await expect(page.locator("#stat-accuracy")).toHaveText("50%");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish session early" }).click();
  await page.locator('[data-mode="mixed"]').click();
  await page.getByRole("button", { name: "Start training" }).click();
  await pressPrompt(page);
  await expect(page.locator("#soul")).toBeVisible();
  await page.getByRole("button", { name: "Shoot soul target" }).click();
  await expect(page.locator("#practice-screen")).toBeVisible();
  await expect(page.locator("#stat-hits")).toHaveText("02");
});

test("rebind, modifier combinations, local import, and reset", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit keybinds", exact: true })
    .click();
  await page.getByRole("button", { name: /^Rebind Melee:/ }).click();
  await page.keyboard.press("k");
  await expect(
    page.getByRole("button", { name: "Rebind Melee: K", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rebind Melee: K", exact: true })
    .click();
  await page.keyboard.press("Shift+KeyQ");
  await expect(
    page.getByRole("button", { name: /Rebind Melee: Shift\s*\+\s*Q/i }),
  ).toBeVisible();
  await page.locator("#import-file").setInputFiles({
    name: "citadelkeys_personal.lst",
    mimeType: "text/plain",
    buffer: Buffer.from(
      '"KeyBindings" { "Keys" { "AbilityMelee" { "Key" "J" } } }',
    ),
  });
  await expect(page.locator("#binding-status")).toContainText("Imported 1");
  await page.getByRole("button", { name: "All set" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit keybinds", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Rebind Melee: J", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset defaults" }).click();
  await expect(
    page.getByRole("button", { name: "Rebind Melee: Q", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close keybind settings" }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("#idle-screen")).toBeVisible();
});

test("tab changes automatically pause and layout fits viewport", async ({
  page,
}) => {
  await page.goto("/");
  const width = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await page.getByRole("button", { name: "Start training" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("#pause-screen")).toBeVisible();
  await page.screenshot({
    path: `test-results/layout-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("blocked localStorage does not break practice", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage disabled");
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("#storage-note")).toContainText(
    "STORAGE UNAVAILABLE",
  );
  await page.getByRole("button", { name: "Start training" }).click();
  await pressPrompt(page);
  await expect(page.locator("#stat-hits")).toHaveText("01");
});

test("modifier key practice does not count the modifier prefix as a mistake", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "deadlock-trainer-v1",
      JSON.stringify({
        settings: {
          group: "combat",
          bindings: {
            AbilityMelee: "SHIFT+Q",
            HeldItem: "SHIFT+Q",
            Reload: "SHIFT+Q",
            Interact: "SHIFT+Q",
          },
        },
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start training" }).click();
  await page.keyboard.press("Shift+KeyQ");
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await expect(page.locator("#stat-accuracy")).toHaveText("100%");
});

test("invalid saved settings fall back safely and all assets are local", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:5173") &&
      !request.url().startsWith("data:")
    )
      external.push(request.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "deadlock-trainer-v1",
      JSON.stringify({
        settings: { mode: "toString", difficulty: "__proto__", duration: -1 },
        history: [null, { mode: "aim", hits: "bad" }],
      }),
    ),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Keybind recall." }),
  ).toBeVisible();
  await expect(page.locator("#stat-time")).toHaveText("01:00");
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(external).toEqual([]);
});

test("expired aim targets count as misses and reserved imports are rejected", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit keybinds", exact: true })
    .click();
  await page.locator("#import-file").setInputFiles({
    name: "bindings.lst",
    mimeType: "text/plain",
    buffer: Buffer.from("AbilityMelee { Key ESCAPE }"),
  });
  await expect(page.locator("#binding-status")).toContainText(
    "No usable practice bindings",
  );
  await page.getByRole("button", { name: "All set" }).click();
  await page.locator('[data-mode="aim"]').click();
  await page.getByRole("button", { name: "Start training" }).click();
  await page.clock.runFor(3300);
  await expect(page.locator("#stat-accuracy")).toHaveText("0%");
  await expect(page.locator("#soul")).toBeVisible();
});

test("compact navigation has accessible names and import is keyboard operable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Soul practice", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mixed training", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Your keybinds", exact: true })
    .click();
  const button = page.getByRole("button", { name: "Import Deadlock .lst" });
  await page.getByRole("button", { name: "Close keybind settings" }).focus();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (
    await chooser
  ).setFiles({
    name: "bindings.lst",
    mimeType: "text/plain",
    buffer: Buffer.from("AbilityMelee { Key J }"),
  });
  await expect(page.locator("#binding-status")).toContainText("Imported 1");
});
