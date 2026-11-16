import { expect, test, type Page } from "@playwright/test";

async function openCombat(
  page: Page,
  scenario: string,
  bindings: Record<string, string> = {},
) {
  await page.addInitScript(
    ({ scenario, bindings }) => {
      if (localStorage.getItem("deadlock-trainer-v1")) return;
      localStorage.setItem(
        "deadlock-trainer-v1",
        JSON.stringify({ settings: { mode: "mixed", scenario, bindings } }),
      );
    },
    { scenario, bindings },
  );
  await page.clock.install({ time: new Date("2026-11-15T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-15T12:01:00Z"));
  await page.goto("/");
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("#arena")).toHaveClass(/is-running/);
}

async function shoot(page: Page) {
  await page.clock.runFor(180);
  const box = await page.locator("#soul").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test.afterEach(async ({ page }) => {
  expect((await page.pageErrors()).map((error) => error.message)).toEqual([]);
});

test("heavy melee requires a continuous hold and commits before release", async ({
  page,
}) => {
  await openCombat(page, "heavy-melee");
  await expect(page.locator("#arena")).toHaveClass(/has-range/);
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(100);
  await page.keyboard.up("KeyQ");
  await expect(page.locator("#stat-hits")).toHaveText("00");
  await expect(page.locator("#stat-accuracy")).toHaveText("0%");
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(550);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await expect(page.locator("#prompt-label")).toHaveText("Release melee");
  await expect(page.locator("#held-inputs")).toContainText("Q");
  await page.keyboard.up("KeyQ");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await page.keyboard.press("KeyF");
  await expect(page.locator("#stat-hits")).toHaveText("03");
});

test("light tap and diagonal hold are distinct from sequential key presses", async ({
  page,
}) => {
  await openCombat(page, "light-melee");
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(100);
  await page.keyboard.up("KeyQ");
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.keyboard.press("KeyA");
  await page.keyboard.down("KeyS");
  await page.clock.runFor(350);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.keyboard.down("KeyA");
  await page.clock.runFor(350);
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await page.keyboard.up("KeyA");
  await page.keyboard.up("KeyS");
});

test("movement-heavy needs all three inputs continuously overlapped", async ({
  page,
}) => {
  await openCombat(page, "moving-heavy");
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(300);
  await expect(page.locator("#held-inputs")).toContainText("W");
  await expect(page.locator("#held-inputs")).toContainText("D");
  await expect(page.locator("#held-inputs")).toContainText("Q");
  await page.keyboard.up("KeyD");
  await page.clock.runFor(400);
  await expect(page.locator("#stat-hits")).toHaveText("00");
  await page.keyboard.up("KeyQ");
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(550);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.keyboard.up("KeyQ");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await page.keyboard.up("KeyW");
  await page.keyboard.up("KeyD");
});

test("safe crouch preserves the game bind and releases independently of melee", async ({
  page,
}) => {
  await openCombat(page, "crouch-melee");
  await expect(page.locator("#key-hint")).toContainText("Caps Lock");
  await page.keyboard.down("CapsLock");
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(550);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.keyboard.up("KeyQ");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await expect(page.locator("#held-inputs")).toContainText("Caps Lock");
  await page.keyboard.up("CapsLock");
  await expect(page.locator("#stat-hits")).toHaveText("03");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish session early" }).click();
  await page
    .getByRole("button", { name: "Your keybinds", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Rebind Crouch / Slide: Ctrl",
      exact: true,
    }),
  ).toBeVisible();
});

test("dash-slide enforces crouch after dash and movement plus crouch during the shot", async ({
  page,
}) => {
  await openCombat(page, "dash-slide");
  await page.keyboard.down("KeyW");
  await page.keyboard.down("CapsLock");
  await page.keyboard.press("Shift");
  await expect(page.locator("#prompt-label")).toHaveText("Forward + dash");
  await expect(page.locator("#feedback")).toContainText(
    "RELEASE CROUCH BEFORE DASHING",
  );
  await page.keyboard.up("CapsLock");
  await page.keyboard.press("Shift");
  await expect(page.locator("#prompt-label")).toHaveText("Add and hold crouch");
  await page.keyboard.down("CapsLock");
  await page.clock.runFor(350);
  await expect(page.locator("#soul")).toBeVisible();
  await shoot(page);
  await expect(page.locator("#stat-hits")).toHaveText("03");
  await expect(page.locator("#prompt-label")).toHaveText("Release crouch only");
  await page.keyboard.up("CapsLock");
  await expect(page.locator("#stat-hits")).toHaveText("04");
  await page.keyboard.up("KeyW");
});

test("movement, right mouse zoom and primary fire can be held together", async ({
  page,
}) => {
  await openCombat(page, "zoom-strafe");
  await page.keyboard.down("KeyD");
  const arena = await page.locator("#arena").boundingBox();
  await page.mouse.move(
    arena!.x + arena!.width / 2,
    arena!.y + arena!.height / 2,
  );
  await page.mouse.down({ button: "right" });
  await page.clock.runFor(300);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await shoot(page);
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await expect(page.locator("#held-inputs")).toContainText("RMB");
  await page.mouse.up({ button: "right" });
  await expect(page.locator("#stat-hits")).toHaveText("03");
  await expect(page.locator("#held-inputs")).toContainText("D");
  await page.screenshot({
    path: `test-results/combat-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.keyboard.up("KeyD");
});

test("pause discards a partial heavy hold rather than granting stale credit", async ({
  page,
}) => {
  await openCombat(page, "heavy-melee");
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(300);
  await page.keyboard.press("Escape");
  await page.keyboard.up("KeyQ");
  await page.clock.runFor(5000);
  await page.getByRole("button", { name: "Resume training" }).click();
  await page.keyboard.down("KeyQ");
  await page.clock.runFor(220);
  await expect(page.locator("#stat-hits")).toHaveText("00");
  await page.clock.runFor(330);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.keyboard.up("KeyQ");
});

test("blue jump cue rejects early presses and requires held direction", async ({
  page,
}) => {
  await openCombat(page, "dash-jump");
  await page.keyboard.down("KeyW");
  await page.keyboard.press("Shift");
  await page.keyboard.press("Space");
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await expect(page.locator("#feedback")).toContainText("TOO EARLY");
  await page.clock.runFor(350);
  await expect(page.locator("#goal-status")).toHaveText("JUMP NOW / BLUE CUE");
  await page.keyboard.press("Space");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await page.keyboard.up("KeyW");
});

test("custom melee bindings use the same held-input engine", async ({
  page,
}) => {
  await openCombat(page, "heavy-melee", {
    AbilityMelee: "SHIFT+J",
    Attack: "K",
  });
  await page.keyboard.down("Shift");
  await page.keyboard.down("KeyJ");
  await page.clock.runFor(550);
  await expect(page.locator("#stat-hits")).toHaveText("01");
  await page.keyboard.up("KeyJ");
  await page.keyboard.up("Shift");
  await expect(page.locator("#stat-hits")).toHaveText("02");
});

test("keyboard fire and zoom bindings work while movement remains held", async ({
  page,
}) => {
  await openCombat(page, "zoom-strafe", { Attack: "K", ADS: "G" });
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyG");
  await page.clock.runFor(300);
  const box = await page.locator("#soul").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.keyboard.press("KeyK");
  await expect(page.locator("#stat-hits")).toHaveText("02");
  await page.keyboard.up("KeyG");
  await expect(page.locator("#stat-hits")).toHaveText("03");
  await page.keyboard.up("KeyD");
});

test("held fire consumes rounds without repeated clicks and reload restores the magazine", async ({
  page,
}) => {
  await openCombat(page, "secure");
  const arena = await page.locator("#arena").boundingBox();
  await page.mouse.move(arena!.x + 8, arena!.y + 350);
  await page.mouse.down();
  await page.clock.runFor(2200);
  await expect(page.locator("#hud-ammo-count")).toHaveText("0 / 12");
  await page.mouse.up();
  await page.keyboard.press("KeyR");
  await expect(page.locator("#hud-reload")).toHaveText("RELOADING...");
  await page.clock.fastForward(1500);
  await expect(page.locator("#hud-ammo-count")).toHaveText("12 / 12");
});

test("explicit mouse button rebindings persist across a page reload", async ({
  page,
}) => {
  await openCombat(page, "secure");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish session early" }).click();
  await page
    .getByRole("button", { name: "Your keybinds", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rebind Fire: LMB", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rebind Fire: LMB", exact: true })
    .click({ button: "right" });
  await expect(
    page.getByRole("button", { name: "Rebind Fire: RMB", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All set" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Your keybinds", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Rebind Fire: RMB", exact: true }),
  ).toBeVisible();
});

test("explicit mouse capture releases when the session pauses", async ({
  page,
}) => {
  test.skip(
    test.info().project.name === "mobile",
    "Mouse-look is a desktop mouse feature.",
  );
  await openCombat(page, "secure");
  await page
    .getByRole("button", { name: "Capture mouse", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id))
    .toBe("range-canvas");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pause-screen")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement))
    .toBeNull();
});

test("no WebGL falls back to local 2D targeting without crashing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind.startsWith("webgl")) return null;
      return Reflect.apply(getContext, this, [kind, ...args]);
    } as typeof getContext;
  });
  await openCombat(page, "secure");
  await expect(page.locator("#arena")).not.toHaveClass(/has-range/);
  await expect(page.locator("#range-status")).toContainText("2D FALLBACK");
  await shoot(page);
  await expect(page.locator("#stat-hits")).toHaveText("01");
});

test("denied mouse capture preserves usable free-cursor practice", async ({
  page,
}) => {
  await openCombat(page, "secure");
  await page.locator("#range-canvas").evaluate((canvas) => {
    canvas.requestPointerLock = () => Promise.reject(new Error("Denied"));
  });
  await page
    .getByRole("button", { name: "Capture mouse", exact: true })
    .click();
  await expect(page.locator("#feedback")).toContainText(
    "FREE CURSOR STILL WORKS",
  );
  await shoot(page);
  await expect(page.locator("#stat-hits")).toHaveText("01");
});

test("mouse-bound reload uses the same action side effects as keyboard reload", async ({
  page,
}) => {
  await openCombat(page, "secure", { Reload: "MOUSE3" });
  const arena = await page.locator("#arena").boundingBox();
  await page.mouse.move(arena!.x + 8, arena!.y + 350);
  await page.mouse.down();
  await page.clock.runFor(2200);
  await page.mouse.up();
  await expect(page.locator("#hud-ammo-count")).toHaveText("0 / 12");
  await page.mouse.click(arena!.x + 8, arena!.y + 350, { button: "middle" });
  await expect(page.locator("#hud-reload")).toHaveText("RELOADING...");
  await page.clock.fastForward(1500);
  await expect(page.locator("#hud-ammo-count")).toHaveText("12 / 12");
});

test("running toolbar remains reachable and activatable with Tab and Enter", async ({
  page,
}) => {
  await openCombat(page, "secure");
  await page.locator("#range-canvas").evaluate((canvas) => {
    canvas.requestPointerLock = () => Promise.reject(new Error("Denied"));
  });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Capture mouse", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#feedback")).toContainText(
    "FREE CURSOR STILL WORKS",
  );
  await expect(page.locator("#arena")).toBeFocused();
});

test("cancelled touch input pauses and clears held fire", async ({ page }) => {
  await openCombat(page, "secure");
  const box = await page.locator("#arena").boundingBox();
  await page.locator("#arena").dispatchEvent("pointerdown", {
    pointerType: "touch",
    button: 0,
    clientX: box!.x + 8,
    clientY: box!.y + 350,
  });
  await expect(page.locator("#held-inputs")).toContainText("LMB");
  await page
    .locator("#arena")
    .dispatchEvent("pointercancel", { pointerType: "touch", button: 0 });
  await expect(page.locator("#pause-screen")).toBeVisible();
  await expect(page.locator("#held-inputs")).toHaveText("");
  const ammo = await page.locator("#hud-ammo-count").innerText();
  await page.clock.runFor(1000);
  await expect(page.locator("#hud-ammo-count")).toHaveText(ammo);
});

for (const sessionDeadline of [false, true]) {
  test(`release cannot score past the ${sessionDeadline ? "session" : "step"} deadline before the next frame`, async ({
    page,
  }) => {
    await openCombat(page, "light-melee");
    await page.clock.fastForward(sessionDeadline ? 59995 : 9595);
    await page.keyboard.down("KeyQ");
    await page.evaluate(() => {
      const afterDeadline = performance.now() + 7;
      Object.defineProperty(performance, "now", { value: () => afterDeadline });
    });
    await page.keyboard.up("KeyQ");
    await expect(page.locator("#stat-hits")).toHaveText("00");
    if (sessionDeadline)
      await expect(page.locator("#result-screen")).toBeVisible();
    else {
      await expect(page.locator("#stat-accuracy")).toHaveText("0%");
      await expect(page.locator("#prompt-label")).toHaveText("Tap melee");
    }
  });
}
