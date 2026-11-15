import { test, expect, type Page } from "@playwright/test";

async function openTrainer(page: Page) {
  await page.clock.install({ time: new Date("2026-11-15T12:00:00Z") });
  // Freeze before loading WebGL; GPU startup must not race a short pauseAt deadline.
  await page.clock.pauseAt(new Date("2026-11-15T12:01:00Z"));
  await page.goto("/");
}

async function pressPrompt(page: Page) {
  const key = await page.locator("#key-hint kbd").innerText();
  const codes: Record<string, string> = {
    Space: "Space",
    Shift: "Shift",
    Ctrl: "Control",
    Control: "Control",
    Alt: "Alt",
  };
  if (["LMB", "RMB", "MMB"].includes(key)) {
    await page.locator("#arena").click({
      position: { x: 200, y: 300 },
      button: key === "RMB" ? "right" : key === "MMB" ? "middle" : "left",
    });
    return;
  }
  await page.keyboard.press(codes[key] || key);
}

async function shootTarget(page: Page) {
  await page.clock.runFor(180);
  const box = await page.locator("#soul").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test("setup, recall, pause, resume, results, and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openTrainer(page);
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
  await page.clock.runFor(1200);
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
  await openTrainer(page);
  await page.getByRole("button", { name: "30s", exact: true }).click();
  await page.getByRole("switch", { name: "Show key hints" }).uncheck();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#key-hint")).toHaveText("TRUST YOUR HANDS");
  await page.keyboard.press("k");
  await expect(page.locator("#stat-accuracy")).toHaveText("0%");
  await page.clock.fastForward(30_100);
  await expect(page.getByRole("heading", { name: "Nice work." })).toBeVisible();
  await expect(page.locator("#stat-time")).toHaveText("00:00");
});

test("aim scores targets and misses; lane practice requires movement while shooting", async ({
  page,
}) => {
  await openTrainer(page);
  await page.locator('[data-mode="aim"]').click();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#soul")).toBeVisible();
  await page.locator("#arena").click({ position: { x: 8, y: 350 } });
  await expect(page.locator("#stat-accuracy")).toHaveText("0%");
  await shootTarget(page);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await expect(page.locator("#stat-accuracy")).toHaveText("50%");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish session early" }).click();
  await page.locator('[data-mode="mixed"]').click();
  await page
    .getByLabel("LANE SITUATION", { exact: true })
    .selectOption("strafe");
  await page.getByRole("button", { name: "Start training" }).click();
  await page.keyboard.down("KeyD");
  await expect(page.locator("#soul")).toBeVisible();
  await shootTarget(page);
  await page.keyboard.up("KeyD");
  await expect(page.locator("#practice-screen")).toBeVisible();
  await expect(page.locator("#stat-hits")).toHaveText("02");
});

test("ranged last hit leads to a rising soul, with motion frozen during pause", async ({
  page,
}) => {
  await openTrainer(page);
  await page.locator('[data-mode="mixed"]').click();
  await page
    .getByLabel("LANE SITUATION", { exact: true })
    .selectOption("secure");
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#soul")).toHaveAttribute("data-kind", "trooper");
  const trooperX = await page
    .locator("#soul")
    .evaluate((element) => parseFloat(element.style.left));
  await shootTarget(page);
  await expect(page.locator("#soul")).toHaveAttribute("data-kind", "secure");
  const soulX = await page
    .locator("#soul")
    .evaluate((element) => parseFloat(element.style.left));
  expect(Math.abs(soulX - trooperX)).toBeLessThan(2);
  const initial = await page
    .locator("#soul")
    .evaluate((element) => parseFloat(element.style.top));
  await page.clock.runFor(1000);
  const moved = await page
    .locator("#soul")
    .evaluate((element) => parseFloat(element.style.top));
  expect(moved).toBeLessThan(initial);
  await page.screenshot({
    path: `test-results/lane-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await page.clock.runFor(5000);
  await page.getByRole("button", { name: "Resume training" }).click();
  await page.clock.runFor(16);
  const resumed = await page
    .locator("#soul")
    .evaluate((element) => parseFloat(element.style.top));
  expect(Math.abs(resumed - moved)).toBeLessThan(2);
  await shootTarget(page);
  await expect(page.locator("#stat-hits")).toHaveText("02");
});

test("dash-jump accepts jump while dash is held and parry cues use real action keys", async ({
  page,
}) => {
  await openTrainer(page);
  await page.locator('[data-mode="mixed"]').click();
  await page
    .getByLabel("LANE SITUATION", { exact: true })
    .selectOption("dash-jump");
  await page.getByRole("button", { name: "Start training" }).click();
  await page.keyboard.down("KeyW");
  await page.keyboard.down("Shift");
  await expect(page.locator("#prompt-label")).toHaveText(
    "Jump on the blue cue",
  );
  await page.clock.runFor(350);
  await page.keyboard.press("Space");
  await page.keyboard.up("Shift");
  await page.keyboard.up("KeyW");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await expect(page.locator("#stat-accuracy")).toHaveText("100%");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish session early" }).click();
  await page.getByRole("button", { name: "Back to setup" }).click();
  await page
    .getByLabel("LANE SITUATION", { exact: true })
    .selectOption("parry");
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#prompt-tip")).toContainText("heavy melee");
  await page.keyboard.press("KeyF");
  await expect(page.locator("#prompt-label")).toHaveText("Move Backward");
  await page.keyboard.press("KeyS");
  await expect(page.locator("#stat-hits")).toHaveText("02");
});

test("movement-and-aim respects custom bindings and clears held keys when paused", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "deadlock-trainer-v1",
      JSON.stringify({
        settings: {
          mode: "mixed",
          scenario: "strafe",
          bindings: { MoveRight: "J" },
        },
      }),
    ),
  );
  await openTrainer(page);
  await page.getByRole("button", { name: "Start training" }).click();
  await page.keyboard.down("KeyJ");
  await expect(page.locator("#hold-hint")).toContainText("HOLD J");
  await page.keyboard.press("Escape");
  await page.keyboard.up("KeyJ");
  await page.getByRole("button", { name: "Resume training" }).click();
  await shootTarget(page);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await expect(page.locator("#feedback")).toContainText("KEEP J HELD");
  await page.keyboard.down("KeyJ");
  await shootTarget(page);
  await page.keyboard.up("KeyJ");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await expect(page.locator("#stat-accuracy")).toHaveText("67%");
});

test("rebind, modifier combinations, local import, and reset", async ({
  page,
}) => {
  await openTrainer(page);
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
  await openTrainer(page);
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
  await openTrainer(page);
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
            Attack: "SHIFT+Q",
            ADS: "SHIFT+Q",
          },
        },
      }),
    );
  });
  await openTrainer(page);
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
  await openTrainer(page);
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
  await openTrainer(page);
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
  await openTrainer(page);
  await expect(
    page.getByRole("button", { name: "Soul practice", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Combat range", exact: true }),
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

test("reduced-motion preference keeps targets still without disabling scoring", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTrainer(page);
  await page.locator('[data-mode="aim"]').click();
  await page.getByRole("button", { name: "Start training" }).click();
  const initial = await page
    .locator("#soul")
    .evaluate((element) => element.style.top);
  await page.clock.runFor(1000);
  await expect(page.locator("#soul")).toHaveCSS("top", initial);
  await shootTarget(page);
  await expect(page.locator("#stat-hits")).toHaveText("01");
});

test("dash-jump accepts custom Ctrl dash while the modifier remains held", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "deadlock-trainer-v1",
      JSON.stringify({
        settings: {
          mode: "mixed",
          scenario: "dash-jump",
          bindings: { Roll: "CTRL" },
        },
      }),
    ),
  );
  await openTrainer(page);
  await page.getByRole("button", { name: "Start training" }).click();
  await page.keyboard.down("KeyW");
  await page.keyboard.down("Control");
  await expect(page.locator("#prompt-label")).toHaveText(
    "Jump on the blue cue",
  );
  await page.clock.runFor(350);
  await page.keyboard.press("Space");
  await page.keyboard.up("Control");
  await page.keyboard.up("KeyW");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await expect(page.locator("#stat-accuracy")).toHaveText("100%");
});

test("a timed-out lane step restarts the situation and keeps its saved selection", async ({
  page,
}) => {
  await openTrainer(page);
  await page.locator('[data-mode="mixed"]').click();
  await page
    .getByLabel("LANE SITUATION", { exact: true })
    .selectOption("reload");
  await page.getByRole("button", { name: "Start training" }).click();
  await page.keyboard.press("KeyA");
  await expect(page.locator("#prompt-label")).toHaveText("Reload");
  await page.clock.runFor(6500);
  await expect(page.locator("#prompt-label")).toHaveText("Move Left");
  await expect(page.locator("#stat-accuracy")).toHaveText("50%");
  await page.reload();
  await expect(page.getByLabel("LANE SITUATION", { exact: true })).toHaveValue(
    "reload",
  );
});
