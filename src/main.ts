import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./style.css";
import "./combat.css";
import {
  ACTIONS,
  accuracy,
  chooseAction,
  displayKey,
  keyFromEvent,
  parseBindings,
  summarize,
  type Action,
} from "./trainer";
import {
  SCENARIOS,
  chooseScenario,
  matchesAction,
  targetContains,
  targetPosition,
  type DrillStep,
  type Scenario,
  type Target,
} from "./drills";
import {
  loadState,
  saveState,
  trainableBinding,
  type Difficulty,
  type Mode,
  type Result,
  type Settings,
} from "./storage";
import { GoalEvaluator, InputState, type InputEdge } from "./input";
import type { PracticeRange } from "./range";
const MODES = {
  "basic-keys": {
    title: "Basic keybinds",
    subtitle: "Learn the buttons first.",
    description:
      "A simple action prompt and its key. Press the matching keyboard or mouse button, one input at a time.",
    tag: "BASIC MANUAL / KEY PROMPTS",
  },
  "basic-aim": {
    title: "Basic click targets",
    subtitle: "Point. Click. Repeat.",
    description:
      "Click stationary 2D targets. No camera movement, weapon reloads, or held-input combinations.",
    tag: "BASIC MANUAL / CLICK TARGETS",
  },
  "basic-mixed": {
    title: "Basic mixed practice",
    subtitle: "Keys and clicks, one at a time.",
    description:
      "Alternate a keybind prompt with a click target. The original simple warm-up, without loading 3D.",
    tag: "BASIC MANUAL / KEYS + CLICKS",
  },
  recall: {
    title: "Keybind recall",
    subtitle: "Think less. React more.",
    description:
      "See an action, press its key. Build the muscle memory that frees you to focus on the fight.",
    tag: "01 / THE FUNDAMENTALS",
  },
  aim: {
    title: "Soul practice",
    subtitle: "Find your next shot.",
    description:
      "Acquire rising souls before they fade. Rehearse securing your souls and denying the enemy's.",
    tag: "02 / THE PRECISION",
  },
  mixed: {
    title: "Combat range",
    subtitle: "Bring it all together.",
    description:
      "Hold, tap, release and overlap your inputs in a third-person practice lane: melee, dash, crouch, zoom and fire.",
    tag: "03 / THE COMBINATION",
  },
};
const LEVELS = {
  rookie: { radius: 29, lifetime: 3200 },
  regular: { radius: 22, lifetime: 2100 },
  sharp: { radius: 15, lifetime: 1400 },
};
let storage: Storage | null = null;
try {
  storage = window.localStorage;
} catch {
  // Browsers can deny even accessing the localStorage property.
}
let { settings, history, storageAvailable } = loadState(storage);

let phase: "idle" | "running" | "paused" | "finished" = "idle";
let remaining = settings.duration * 1000;
let deadline = 0;
let promptStarted = 0;
let promptDeadline = 0;
let hits = 0;
let attempts = 0;
let streak = 0;
let reactions: number[] = [];
let current: Action | null = null;
let target: Target | null = null;
let task: "key" | "target" | "input" = "key";
let taskIndex = 0;
let scenario: Scenario | null = null;
let scenarioStep = 0;
let previousScenarioId: string | undefined;
let step: DrillStep | null = null;
const input = new InputState();
const evaluator = new GoalEvaluator((actionId) => actionBinding(actionId));
let range: PracticeRange | null = null;
let starting = false;
let goalProgress = 0;
let activeTime = 0;
let lastFrameTime = 0;
const rangeFrameInterval = 1000 / 60;
let rangeFrameBudget = rangeFrameInterval;
let pendingRangeDelta = 0;
let ammo = 12;
let reloadingUntil = 0;
let nextShotAt = 0;
let meleeFlashUntil = 0;
let parryFlashUntil = 0;
let pointer = { x: 0, y: 0 };
let captureTransition = false;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let frame = 0;
let feedbackTimer = 0;
let capture: string | null = null;
let pauseTime = 0;
let lastShownSecond = -1;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
function text(id: string, value: string) {
  el(id).textContent = value;
}
function isBasicMode(mode: Mode = settings.mode) {
  return mode.startsWith("basic-");
}
function has3DRange() {
  return !isBasicMode() && !!range?.available;
}
function save() {
  storageAvailable = saveState(storage, settings, history);
  text(
    "storage-note",
    storageAvailable
      ? "YOUR SETTINGS STAY IN THIS BROWSER."
      : "STORAGE UNAVAILABLE. PROGRESS IS TEMPORARY.",
  );
}
function actions(useSafety = true) {
  return ACTIONS.map((a) => {
    let key = settings.bindings[a.id] || a.key;
    if (
      useSafety &&
      settings.mode === "mixed" &&
      settings.safeCrouch &&
      a.id === "Crouch" &&
      key.split("+").includes("CTRL")
    )
      key = "CAPSLOCK";
    return { ...a, key };
  });
}
function actionBinding(id: string) {
  return actions().find((action) => action.id === id)?.key || "";
}
function actionHeld(id: string) {
  return input.held(actionBinding(id));
}
function formatTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function stats() {
  text("stat-time", formatTime(remaining));
  text("stat-hits", String(hits).padStart(2, "0"));
  text("stat-accuracy", attempts ? `${accuracy(hits, attempts)}%` : "--%");
  text("stat-streak", String(streak).padStart(2, "0"));
  updateHud();
}
function updateSetup() {
  const mode = MODES[settings.mode];
  text("mode-tag", mode.tag);
  text("mode-title", mode.title + ".");
  text("mode-description", mode.description);
  text("arena-subtitle", mode.subtitle);
  text(
    "arena-instructions",
    settings.mode === "basic-aim"
      ? "Click the target with your left mouse button.\nNo holds, camera controls, or reloads."
      : settings.mode === "basic-mixed"
        ? "Press the prompted key, then click the target.\nOne input at a time. No combos required."
        : settings.mode === "basic-keys"
          ? "Read the action. Press its key or mouse button.\nKeep hints on while learning the controls."
          : settings.mode === "aim"
            ? "Souls rise after a ranged last hit.\nFind them, then click before they fade."
            : settings.mode === "mixed"
              ? "A third-person range for actual input overlap.\nHold melee. Keep moving. Crouch, aim and fire together."
              : "An action appears. You press the key.\nSimple reps for a sharper game.",
  );
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
    const active = b.dataset.mode === settings.mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-duration]")
    .forEach((b) => {
      const active = Number(b.dataset.duration) === settings.duration;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  el<HTMLSelectElement>("difficulty").value = settings.difficulty;
  el<HTMLSelectElement>("group").value = settings.group;
  el<HTMLSelectElement>("scenario").value = settings.scenario;
  el<HTMLInputElement>("hints").checked = settings.hints;
  el("group-setting").hidden = ![
    "recall",
    "basic-keys",
    "basic-mixed",
  ].includes(settings.mode);
  el("scenario-setting").hidden = settings.mode !== "mixed";
  el("hint-setting").hidden =
    settings.mode === "aim" || settings.mode === "basic-aim";
  el("combat-settings").hidden = settings.mode !== "mixed";
  el<HTMLInputElement>("safe-crouch").checked = settings.safeCrouch;
  el<HTMLInputElement>("sensitivity").value = String(settings.sensitivity);
  text(
    "difficulty-copy",
    settings.mode === "mixed"
      ? {
          rookie: "Assisted blue jump cue: 300-900 ms. Generous response time.",
          regular: "Blue jump cue: 300-700 ms. Smaller targets.",
          sharp:
            "Blue jump cue: 300-550 ms, based on the June 30 reference. Not live-game validation.",
        }[settings.difficulty]
      : settings.difficulty === "rookie"
        ? "Bigger targets. More time to find your feet."
        : settings.difficulty === "regular"
          ? "Smaller targets. A little more urgency."
          : "Tiny targets. Quick decisions. Stay sharp.",
  );
  text(
    "coach-copy",
    isBasicMode()
      ? "Basic Manual is lightweight 2D practice: single key prompts and left-click targets. Your 3D Combat range and hold/combo drills are still available in the sidebar."
      : settings.mode === "mixed"
        ? "Heavy melee completes while held, not on release. The third-person view and hold timings are training models, not Deadlock's engine. Safe crouch uses CapsLock instead of Ctrl in combat drills only."
        : settings.mode === "aim"
          ? "A simplified 3D mouse warm-up, not an in-game sensitivity match. Use your usual mouse DPI; finish with a few minutes in the sandbox."
          : "Start with hints on. Once the keys feel familiar, switch them off and trust your hands.",
  );
  const refs = actions().filter((a) =>
    [
      "AbilityMelee",
      "HeldItem",
      "Roll",
      "Mantle",
      "Ability1",
      "Item1",
    ].includes(a.id),
  );
  el("reference-keys").replaceChildren(
    ...refs.map((a) => {
      const row = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = a.label;
      const key = document.createElement("kbd");
      key.textContent = displayKey(a.key);
      row.append(label, key);
      return row;
    }),
  );
  const last = history.find((r) => r.mode === settings.mode);
  el("last-session").replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = last
    ? `${accuracy(last.hits, last.attempts)}% accuracy`
    : "A fresh start.";
  const desc = document.createElement("p");
  desc.textContent = last
    ? `${last.hits} correct / ${last.median || "--"} ms median response`
    : "Your progress starts with one session.";
  el("last-session").append(strong, desc);
  renderHudBindings();
  if (phase === "idle") {
    remaining = settings.duration * 1000;
    stats();
  }
}
function showPhase() {
  syncKeyboardListeners();
  el("idle-screen").hidden = phase !== "idle";
  el("pause-screen").hidden = phase !== "paused";
  el("result-screen").hidden = phase !== "finished";
  el("practice-screen").hidden = phase !== "running" || task === "target";
  el("soul").hidden = phase !== "running" || task !== "target";
  el("target-context").hidden = phase !== "running" || task !== "target";
  el("situation-banner").hidden =
    phase !== "running" || settings.mode !== "mixed";
  el("arena-bottom").hidden = phase === "running";
  el("range-hud").hidden = phase !== "running" || isBasicMode();
  el("range-canvas").hidden = isBasicMode();
  el("arena").classList.toggle("has-range", has3DRange());
  el("arena").classList.toggle("basic-mode", isBasicMode());
  el("arena").classList.toggle("combat-mode", settings.mode === "mixed");
  el<HTMLButtonElement>("pause-button").disabled = phase !== "running";
  const busy = starting || phase === "running" || phase === "paused";
  el<HTMLFieldSetElement>("settings-fields").disabled = busy;
  el<HTMLButtonElement>("start-button").disabled = starting;
  el<HTMLButtonElement>("again-button").disabled = starting;
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((b) => (b.disabled = busy));
  el<HTMLButtonElement>("bindings-button").disabled = busy;
  el<HTMLButtonElement>("edit-bindings").disabled = busy;
  text(
    "arena-label",
    starting
      ? "LOADING 3D RANGE"
      : phase === "running"
        ? "SESSION IN PROGRESS"
        : phase === "paused"
          ? "SESSION PAUSED"
          : phase === "finished"
            ? "SESSION COMPLETE"
            : "READY WHEN YOU ARE",
  );
  el("arena").classList.toggle("is-running", phase === "running");
  updateHud();
}
function nextTask(now: number) {
  step = null;
  if (settings.mode === "mixed") {
    if (!scenario || scenarioStep >= scenario.steps.length) {
      scenario = chooseScenario(settings.scenario, previousScenarioId);
      previousScenarioId = scenario.id;
      scenarioStep = 0;
    }
    step = scenario.steps[scenarioStep++]!;
    task = step.kind;
    text(
      "situation-banner",
      `${scenario.title} / ${scenarioStep} OF ${scenario.steps.length}`,
    );
  } else
    task =
      settings.mode === "aim" ||
      settings.mode === "basic-aim" ||
      (settings.mode === "basic-mixed" && taskIndex++ % 2 === 1)
        ? "target"
        : "key";
  promptStarted = now;
  const level = LEVELS[settings.difficulty];
  promptDeadline = now + (task === "key" ? level.lifetime * 2 : level.lifetime);
  goalProgress = 0;
  el("crosshair").classList.remove("jump-ready");
  el("goal-meter").hidden = task !== "input";
  text("goal-status", "");
  if (step?.kind === "input") {
    current = null;
    target = null;
    range?.setTarget(null);
    el("goal-meter").dataset.kind = step.timedJump
      ? "jump"
      : step.goal.behavior;
    evaluator.begin(step.goal, now, input);
    promptDeadline =
      now +
      (step.timedJump
        ? settings.difficulty === "rookie"
          ? 900
          : settings.difficulty === "regular"
            ? 700
            : 550
        : level.lifetime * 3);
    text(
      "prompt-category",
      `${step.goal.behavior.toUpperCase()} / OVERLAPPING INPUTS`,
    );
    text("prompt-label", step.label);
    text("prompt-tip", step.cue);
    renderInputHints([...(step.goal.with || []), ...step.goal.actions]);
    updateGoal(now);
    renderRange(now, 0);
    showPhase();
    return;
  }
  if (task === "key") {
    range?.setTarget(null);
    const pool = actions().filter(
      (a) => settings.group === "all" || a.group === settings.group,
    );
    const actionId = step?.kind === "key" ? step.actionId : null;
    current = actionId
      ? actions().find((action) => action.id === actionId)!
      : chooseAction(pool, current?.id);
    text("prompt-category", `${current.group.toUpperCase()} / PRESS THE KEY`);
    text("prompt-label", current.label);
    el("key-hint").replaceChildren();
    if (settings.hints) {
      const key = document.createElement("kbd");
      key.textContent = displayKey(current.key);
      el("key-hint").append(key);
    } else text("key-hint", "TRUST YOUR HANDS");
    text("prompt-tip", step?.cue || current.tip);
  } else {
    const arena = el("arena");
    const margin = level.radius + 38;
    const kind = isBasicMode()
      ? "secure"
      : step?.kind === "target"
        ? step.target
        : taskIndex++ % 2 === 0
          ? "secure"
          : "deny";
    const lastHit =
      kind === "secure" && target?.kind === "trooper" ? target : null;
    const minY = Math.max(225, arena.clientHeight * 0.6);
    const maxY = arena.clientHeight - level.radius - 45;
    target = {
      x:
        lastHit?.x ??
        margin + Math.random() * Math.max(0, arena.clientWidth - margin * 2),
      y: lastHit
        ? lastHit.y - 20
        : minY + Math.random() * Math.max(0, maxY - minY),
      radius: level.radius,
      kind,
    };
    range?.setTarget(kind, level.radius / 29, !!lastHit);
    const soul = el("soul");
    soul.dataset.kind = kind;
    soul.setAttribute(
      "aria-label",
      isBasicMode()
        ? "Click practice target"
        : kind === "trooper"
          ? "Shoot trooper target"
          : "Shoot soul target",
    );
    text(
      "target-label",
      isBasicMode()
        ? "Click the target"
        : kind === "trooper"
          ? "Land the ranged last hit"
          : kind === "secure"
            ? "Secure your soul"
            : "Deny the enemy soul",
    );
    text(
      "target-tip",
      isBasicMode()
        ? "One left click. Then the next prompt."
        : step?.cue ||
            (kind === "secure"
              ? "Your ranged last hit released this soul. Shoot to secure it."
              : "The enemy's ranged last hit released this soul. Shoot to deny it."),
    );
    const required = requiredActions();
    text(
      "hold-hint",
      isBasicMode()
        ? "LEFT CLICK / SIMPLE 2D PRACTICE"
        : required.length
          ? settings.hints
            ? `HOLD ${required.map((a) => displayKey(a.key)).join(" + ")} WHILE FIRING`
            : `KEEP ${required.map((a) => a.label.toUpperCase()).join(" + ")} HELD WHILE FIRING`
          : `${displayKey(actionBinding("Attack"))} FIRE / ${displayKey(actionBinding("ADS"))} ZOOM`,
    );
    soul.style.width = soul.style.height = `${target.radius * 2}px`;
  }
  renderRange(now, 0);
  showPhase();
}
function arenaBounds() {
  return { width: el("arena").clientWidth, height: el("arena").clientHeight };
}
function targetElapsed(now: number) {
  return isBasicMode() || reducedMotion.matches ? 0 : now - promptStarted;
}
function requiredActions() {
  if (step?.kind !== "target") return [];
  const ids =
    step.heldActions || (step.holdActionId ? [step.holdActionId] : []);
  return actions().filter((action) => ids.includes(action.id));
}
function renderTarget(
  now: number,
  projection: ReturnType<PracticeRange["render"]>,
) {
  if (!target || task !== "target") return;
  const position =
    has3DRange() && projection
      ? projection
      : targetPosition(target, targetElapsed(now), arenaBounds());
  el("soul").style.left = `${position.x}px`;
  el("soul").style.top = `${position.y}px`;
  if (projection && has3DRange()) {
    el("soul").style.width = `${projection.width}px`;
    el("soul").style.height = `${projection.height}px`;
    el("soul").hidden = phase !== "running" || !projection.visible;
  }
  const progress = Math.min(
    1,
    (now - promptStarted) / (promptDeadline - promptStarted),
  );
  el("soul").style.opacity = String(1 - progress * 0.4);
  const required = requiredActions();
  el("hold-hint").classList.toggle(
    "is-held",
    !!required.length && required.every((action) => input.held(action.key)),
  );
}
function renderRange(now: number, delta: number) {
  if (isBasicMode()) {
    renderTarget(now, null);
    return;
  }
  const held = new Set(
    actions()
      .filter((action) => input.held(action.key))
      .map((action) => action.id),
  );
  const melee =
    step?.kind === "input" && step.goal.actions.includes("AbilityMelee");
  const cue =
    activeTime < parryFlashUntil
      ? "parry"
      : current?.id === "HeldItem"
        ? "enemy-melee"
        : melee || activeTime < meleeFlashUntil
          ? "player-melee"
          : task === "input"
            ? "movement"
            : "none";
  const projection =
    range?.render({
      now: activeTime,
      delta,
      running: phase === "running",
      actions: held,
      cue,
      progress: activeTime < meleeFlashUntil ? 1 : goalProgress,
      reducedMotion: reducedMotion.matches,
    }) ?? null;
  renderTarget(now, projection);
  const center = document.pointerLockElement === el("range-canvas");
  el("crosshair").style.left =
    `${center ? arenaBounds().width / 2 : pointer.x || arenaBounds().width / 2}px`;
  el("crosshair").style.top =
    `${center ? arenaBounds().height / 2 : pointer.y || arenaBounds().height / 2}px`;
}
function renderInputHints(ids: readonly string[]) {
  el("key-hint").replaceChildren();
  if (!settings.hints) {
    text("key-hint", "WATCH YOUR HELD INPUTS");
    return;
  }
  for (const id of [...new Set(ids)]) {
    const key = document.createElement("kbd");
    key.textContent = displayKey(actionBinding(id));
    key.dataset.action = id;
    el("key-hint").append(key);
  }
}
function updateGoal(now: number, edge?: InputEdge) {
  if (phase !== "running" || step?.kind !== "input") return;
  if (inputExpired(now)) return;
  const elapsed = now - promptStarted;
  const ready = elapsed >= (step.readyAfterMs || 0);
  el("crosshair").classList.toggle("jump-ready", !!step.timedJump && ready);
  const primary =
    edge?.kind === "down" &&
    !edge.repeat &&
    step.goal.actions.some(
      (id) => actionBinding(id).split("+").at(-1) === edge.key,
    );
  if (primary && step.releasedActions?.some(actionHeld)) {
    record(false, now, false);
    feedback("RELEASE CROUCH BEFORE DASHING.", false);
    return;
  }
  if (!ready) {
    goalProgress = Math.min(1, elapsed / (step.readyAfterMs || 1));
    text("goal-status", "WAIT FOR THE BLUE JUMP CUE");
    el("goal-meter").dataset.state = "waiting";
    if (primary) {
      record(false, now, false);
      feedback("TOO EARLY. WAIT FOR THE BLUE CUE.", false);
    }
  } else {
    const result = evaluator.update(input, now, edge);
    const note = result.note.replace(
      /\b(?:MOUSE[1-5]|CAPSLOCK|CTRL|SHIFT|SPACE)\b/g,
      (key) => displayKey(key),
    );
    goalProgress = result.progress;
    text(
      "goal-status",
      step.timedJump
        ? "JUMP NOW / BLUE CUE"
        : note ||
            (step.goal.behavior === "hold"
              ? "KEEP ALL REQUIRED INPUTS HELD"
              : step.goal.behavior === "release"
                ? "RELEASE ONLY THE INDICATED INPUT"
                : "ASSEMBLE THE INPUTS"),
    );
    el("goal-meter").dataset.state = "ready";
    if (result.failed) {
      record(false, now, false);
      feedback(note || "KEEP THE REQUIRED INPUTS OVERLAPPED.", false);
    }
    if (result.complete) {
      if (
        step.goal.actions.includes("AbilityMelee") &&
        step.goal.behavior === "hold"
      )
        meleeFlashUntil = activeTime + 300;
      record(true, now);
      return;
    }
  }
  el("goal-meter-fill").style.width = `${goalProgress * 100}%`;
}
function inputExpired(now: number) {
  if (now >= deadline) {
    remaining = 0;
    finish();
    return true;
  }
  if (now >= promptDeadline) {
    record(false, now);
    return true;
  }
  return false;
}
function renderHudBindings() {
  if (isBasicMode()) return;
  for (const [id, group] of [
    ["hud-items", "items"],
    ["hud-abilities", "abilities"],
    ["hud-movement", "movement"],
  ] as const) {
    el(id).replaceChildren(
      ...actions()
        .filter(
          (action) =>
            action.group === group &&
            (group !== "movement" ||
              ["Roll", "Mantle", "Crouch"].includes(action.id)),
        )
        .map((action, index) => {
          const slot = document.createElement("div");
          slot.className = "hud-slot";
          slot.dataset.action = action.id;
          const icon = document.createElement("span");
          icon.textContent =
            group === "movement"
              ? action.id === "Roll"
                ? "DASH"
                : action.id === "Mantle"
                  ? "JUMP"
                  : "CROUCH"
              : String(index + 1);
          const key = document.createElement("kbd");
          key.textContent = displayKey(action.key);
          slot.append(icon, key);
          return slot;
        }),
    );
  }
}
function updateHud() {
  if (isBasicMode()) return;
  const keys = [...input.keys];
  el("held-inputs").replaceChildren(
    ...keys.map((key) => {
      const kbd = document.createElement("kbd");
      kbd.textContent = displayKey(key);
      return kbd;
    }),
  );
  document
    .querySelectorAll<HTMLElement>("[data-action]")
    .forEach((slot) =>
      slot.classList.toggle("is-down", actionHeld(slot.dataset.action!)),
    );
  text("hud-ammo-count", `${ammo} / 12`);
  text(
    "hud-reload",
    reloadingUntil > activeTime
      ? "RELOADING..."
      : `${displayKey(actionBinding("Reload"))} RELOAD`,
  );
}
function feedback(message: string, good: boolean) {
  clearTimeout(feedbackTimer);
  text("feedback", message);
  el("feedback").className = `feedback ${good ? "good" : "bad"}`;
  feedbackTimer = window.setTimeout(() => text("feedback", ""), 750);
}
function record(success: boolean, now: number, advance = true) {
  attempts++;
  if (success) {
    hits++;
    streak++;
    reactions.push(now - promptStarted);
    feedback(
      streak >= 3 ? `${streak} IN A ROW. KEEP IT GOING.` : "CLEAN INPUT.",
      true,
    );
  } else {
    streak = 0;
    feedback(advance ? "TIME UP. NEXT ONE." : "NOT QUITE. TRY AGAIN.", false);
  }
  stats();
  if (advance) {
    if (!success) scenario = null;
    nextTask(now);
  }
}
function tick(now: number) {
  if (phase !== "running") return;
  const elapsed = Math.max(0, now - lastFrameTime);
  pendingRangeDelta += Math.min(0.05, elapsed / 1000);
  rangeFrameBudget += elapsed;
  activeTime += elapsed;
  lastFrameTime = now;
  remaining = Math.max(0, deadline - now);
  if (remaining <= 0) {
    finish();
    return;
  }
  if (Math.ceil(remaining / 1000) !== lastShownSecond) {
    lastShownSecond = Math.ceil(remaining / 1000);
    stats();
  }
  if (reloadingUntil && activeTime >= reloadingUntil) {
    reloadingUntil = 0;
    ammo = 12;
    updateHud();
  }
  if (now >= promptDeadline) record(false, now);
  if (task === "input") updateGoal(now);
  // Keep input grading responsive on high-refresh displays without drawing every refresh.
  if (!isBasicMode() && rangeFrameBudget >= rangeFrameInterval) {
    rangeFrameBudget %= rangeFrameInterval;
    renderRange(now, pendingRangeDelta);
    pendingRangeDelta = 0;
  }
  if (
    !isBasicMode() &&
    task === "target" &&
    actionHeld("Attack") &&
    activeTime >= nextShotAt
  )
    shoot(now);
  frame = requestAnimationFrame(tick);
}
async function start() {
  if (starting || phase === "running" || phase === "paused") return;
  if (!isBasicMode() && !range) {
    starting = true;
    showPhase();
    try {
      const { PracticeRange } = await import("./range");
      range = new PracticeRange(el<HTMLCanvasElement>("range-canvas"));
    } catch {
      feedback("3D COULD NOT LOAD. USING THE 2D FALLBACK.", false);
    } finally {
      starting = false;
    }
  }
  text(
    "range-status",
    range?.available
      ? "FREE CURSOR · ORIGINAL PRACTICE RANGE"
      : "2D FALLBACK · WEBGL UNAVAILABLE",
  );
  cancelAnimationFrame(frame);
  clearTimeout(feedbackTimer);
  text("feedback", "");
  hits = attempts = streak = taskIndex = 0;
  reactions = [];
  current = null;
  target = null;
  scenario = null;
  scenarioStep = 0;
  previousScenarioId = undefined;
  input.clear();
  range?.reset();
  range?.resize();
  activeTime = 0;
  lastFrameTime = performance.now();
  rangeFrameBudget = rangeFrameInterval;
  pendingRangeDelta = 0;
  ammo = 12;
  reloadingUntil = nextShotAt = meleeFlashUntil = parryFlashUntil = 0;
  pointer = { x: arenaBounds().width / 2, y: arenaBounds().height / 2 };
  lastShownSecond = -1;
  remaining = settings.duration * 1000;
  deadline = performance.now() + remaining;
  phase = "running";
  nextTask(performance.now());
  stats();
  el("arena").focus();
  frame = requestAnimationFrame(tick);
  if (document.hidden || !document.hasFocus()) pause();
}
function pause() {
  if (phase !== "running") return;
  pauseTime = performance.now();
  remaining = Math.max(0, deadline - pauseTime);
  if (remaining <= 0) {
    finish();
    return;
  }
  phase = "paused";
  input.clear();
  releaseCapture();
  cancelAnimationFrame(frame);
  clearTimeout(feedbackTimer);
  text("feedback", "");
  showPhase();
  renderRange(pauseTime, 0);
  el("resume-button").focus();
}
function resume() {
  if (phase !== "paused") return;
  const now = performance.now();
  const pausedFor = now - pauseTime;
  deadline = now + remaining;
  promptStarted += pausedFor;
  promptDeadline += pausedFor;
  lastFrameTime = now;
  rangeFrameBudget = rangeFrameInterval;
  pendingRangeDelta = 0;
  phase = "running";
  if (step?.kind === "input" && step.timedJump) {
    scenarioStep = 0;
    nextTask(now);
  } else if (step?.kind === "input") {
    promptStarted = now;
    promptDeadline = now + LEVELS[settings.difficulty].lifetime * 3;
    evaluator.begin(step.goal, now, input);
    goalProgress = 0;
  }
  showPhase();
  el("arena").focus();
  frame = requestAnimationFrame(tick);
}
function finish() {
  cancelAnimationFrame(frame);
  phase = "finished";
  input.clear();
  releaseCapture();
  clearTimeout(feedbackTimer);
  text("feedback", "");
  const duration = Math.max(
    0,
    Math.round(settings.duration - remaining / 1000),
  );
  const result: Result = {
    mode: settings.mode,
    hits,
    attempts,
    median: summarize(reactions),
    duration,
    date: new Date().toISOString(),
  };
  history = [result, ...history].slice(0, 20);
  save();
  text(
    "result-copy",
    `${duration} seconds of practice. ${attempts ? "A little more automatic than before." : "No inputs yet. Your next rep is waiting."}`,
  );
  text("result-hits", String(hits));
  text("result-accuracy", `${accuracy(hits, attempts)}%`);
  text("result-median", result.median ? `${result.median} ms` : "--");
  stats();
  updateSetup();
  showPhase();
  el("again-button").focus();
}
function changeSetup(change: Partial<Settings>) {
  if (starting || phase === "running" || phase === "paused") return;
  settings = { ...settings, ...change };
  if (isBasicMode() && range) {
    range.dispose();
    range = null;
  }
  phase = "idle";
  updateSetup();
  showPhase();
  save();
}

document
  .querySelectorAll<HTMLButtonElement>("[data-mode]")
  .forEach((b) =>
    b.addEventListener("click", () =>
      changeSetup({ mode: b.dataset.mode as Mode }),
    ),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-duration]")
  .forEach((b) =>
    b.addEventListener("click", () =>
      changeSetup({ duration: Number(b.dataset.duration) }),
    ),
  );
el("difficulty").addEventListener("change", () =>
  changeSetup({
    difficulty: el<HTMLSelectElement>("difficulty").value as Difficulty,
  }),
);
el("group").addEventListener("change", () =>
  changeSetup({
    group: el<HTMLSelectElement>("group").value as Settings["group"],
  }),
);
el("scenario").addEventListener("change", () =>
  changeSetup({ scenario: el<HTMLSelectElement>("scenario").value }),
);
el("hints").addEventListener("change", () =>
  changeSetup({ hints: el<HTMLInputElement>("hints").checked }),
);
el("safe-crouch").addEventListener("change", () =>
  changeSetup({ safeCrouch: el<HTMLInputElement>("safe-crouch").checked }),
);
el("sensitivity").addEventListener("input", () =>
  changeSetup({
    sensitivity: Number(el<HTMLInputElement>("sensitivity").value),
  }),
);
el("start-button").addEventListener("click", start);
el("again-button").addEventListener("click", start);
el("pause-button").addEventListener("click", pause);
el("resume-button").addEventListener("click", resume);
el("end-button").addEventListener("click", finish);
el("back-button").addEventListener("click", () => {
  phase = "idle";
  updateSetup();
  showPhase();
  el("start-button").focus();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("blur", pause);
window.addEventListener("resize", () => {
  if (phase === "running" && !captureTransition) pause();
  range?.resize();
  renderRange(performance.now(), 0);
});
reducedMotion.addEventListener("change", pause);

function syncKeyboardListeners() {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("keyup", handleKeyup);
  if (phase === "running" || phase === "paused" || capture) {
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("keyup", handleKeyup);
  }
}
function finishRebind(key: string) {
  if (!capture) return;
  const id = capture;
  settings.bindings[id] = key;
  capture = null;
  save();
  renderBindings();
  updateSetup();
  text("binding-status", "Binding saved.");
  document.querySelector<HTMLButtonElement>(`[data-binding="${id}"]`)?.focus();
}
function handleKeyup(event: KeyboardEvent) {
  const edge = input.keyUp(event, performance.now());
  if (phase === "running") {
    updateGoal(performance.now(), edge);
    updateHud();
  }
  if (!capture || !["Shift", "Control", "Alt"].includes(event.key)) return;
  event.preventDefault();
  finishRebind(keyFromEvent(event));
}
function handleKeydown(event: KeyboardEvent) {
  if (capture) {
    event.preventDefault();
    if (event.repeat) return;
    if (event.key === "Escape") {
      capture = null;
      renderBindings();
      return;
    }
    if (["Shift", "Control", "Alt"].includes(event.key)) return;
    const key = keyFromEvent(event);
    if (!trainableBinding(key)) {
      text(
        "binding-status",
        "Use a letter, number, arrow, Space, Shift, Ctrl, or Alt. Browser shortcuts cannot be reliably captured.",
      );
      return;
    }
    finishRebind(key);
    return;
  }
  if (phase === "paused" && event.key === "Escape") {
    event.preventDefault();
    resume();
    return;
  }
  if (phase !== "running") return;
  if (event.key === "Escape") {
    event.preventDefault();
    pause();
    return;
  }
  if (
    event.key === "Tab" ||
    (event.target instanceof Element &&
      event.target.closest(
        "button, input, select, textarea, a, [contenteditable=true]",
      ))
  )
    return;
  const now = performance.now();
  const edge = input.keyDown(event, now);
  if (event.ctrlKey || event.metaKey || event.altKey) {
    // Leave browser shortcuts alone unless this input belongs to the current drill.
    const key = keyFromEvent(event);
    const expected =
      task === "key" &&
      current &&
      matchesAction(event, current, settings.mode === "mixed");
    if (
      !expected &&
      !actions().some(
        (a) => a.key === key || a.key.split("+").at(-1) === edge.key,
      )
    )
      return;
  }
  event.preventDefault();
  updateHud();
  if (event.repeat) return;
  applyActionEdges(edge);
  if (now >= deadline) {
    remaining = 0;
    finish();
    return;
  }
  if (now >= promptDeadline) {
    record(false, now);
    return;
  }
  if (task === "input") {
    updateGoal(now, edge);
    renderRange(now, 0);
    return;
  }
  if (task === "target") {
    renderRange(now, 0);
    if (
      !isBasicMode() &&
      edge.key === actionBinding("Attack").split("+").at(-1) &&
      actionHeld("Attack")
    )
      shoot(now);
    return;
  }
  const key = keyFromEvent(event);
  if (
    current?.key.includes("+") &&
    ["CTRL", "ALT", "SHIFT"].includes(key) &&
    current.key.split("+").includes(key)
  )
    return;
  if (key && current) {
    const success = matchesAction(event, current, settings.mode === "mixed");
    record(success, now, success);
  }
}
function shoot(now: number) {
  if (phase !== "running" || task !== "target" || !target) return;
  if (inputExpired(now)) return;
  if (isBasicMode()) {
    const success = targetContains(
      target,
      0,
      arenaBounds(),
      pointer.x,
      pointer.y,
    );
    record(success, now, success);
    return;
  }
  if (activeTime < nextShotAt) return;
  nextShotAt = activeTime + 160;
  if (reloadingUntil > activeTime || ammo <= 0) {
    feedback(
      ammo <= 0
        ? `EMPTY MAGAZINE. ${displayKey(actionBinding("Reload"))} TO RELOAD.`
        : "RELOADING...",
      false,
    );
    return;
  }
  ammo--;
  updateHud();
  const required = requiredActions();
  if (!required.every((action) => input.held(action.key))) {
    record(false, now, false);
    feedback(
      `KEEP ${required.map((action) => (settings.hints ? displayKey(action.key) : action.label)).join(" + ")} HELD WHILE FIRING.`,
      false,
    );
    return;
  }
  const locked = document.pointerLockElement === el("range-canvas");
  const aim = locked
    ? { x: arenaBounds().width / 2, y: arenaBounds().height / 2 }
    : pointer;
  renderRange(now, 0);
  const success = has3DRange()
    ? range!.hitTest(aim.x, aim.y)
    : targetContains(target, targetElapsed(now), arenaBounds(), aim.x, aim.y);
  record(success, now, success);
}
function applyActionEdges(edge: InputEdge) {
  if (isBasicMode()) return;
  if (edge.kind !== "down" || edge.repeat || edge.changed === false) return;
  if (
    edge.key === actionBinding("Reload").split("+").at(-1) &&
    actionHeld("Reload")
  ) {
    reloadingUntil = activeTime + 1400;
    updateHud();
  }
  if (
    edge.key === actionBinding("HeldItem").split("+").at(-1) &&
    actionHeld("HeldItem")
  )
    parryFlashUntil = activeTime + 600;
}
function handleButtonDown(event: MouseEvent) {
  if (
    phase !== "running" ||
    (event.target as HTMLElement).closest(".range-toolbar")
  )
    return;
  event.preventDefault();
  el("arena").focus();
  const now = performance.now();
  if (now >= deadline) {
    remaining = 0;
    finish();
    return;
  }
  if (now >= promptDeadline) {
    record(false, now);
    return;
  }
  updatePointer(event);
  const edge = input.pointerDown(event.button, now);
  applyActionEdges(edge);
  updateHud();
  if (task === "input") updateGoal(now, edge);
  else if (task === "target" && isBasicMode()) {
    if (event.button === 0) shoot(now);
  } else if (
    task === "target" &&
    edge.key === actionBinding("Attack").split("+").at(-1) &&
    actionHeld("Attack")
  )
    shoot(now);
  else if (task === "key" && current) {
    const binding = pointerBinding(event);
    record(binding === current.key, now, binding === current.key);
  }
  renderRange(now, 0);
}
// Pointer events report only the first/last mouse button in a chord; mouse events report every edge.
el("arena").addEventListener("mousedown", handleButtonDown);
el("arena").addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse") handleButtonDown(event);
});
function updatePointer(event: MouseEvent) {
  if (document.pointerLockElement === el("range-canvas"))
    range?.look(
      event.movementX * settings.sensitivity,
      event.movementY * settings.sensitivity,
    );
  else {
    const rect = el("arena").getBoundingClientRect();
    pointer = {
      x: event.clientX - rect.left - el("arena").clientLeft,
      y: event.clientY - rect.top - el("arena").clientTop,
    };
  }
}
el("arena").addEventListener("pointermove", (event) => {
  if (phase === "running") {
    updatePointer(event);
  }
});
function handleButtonUp(event: MouseEvent) {
  const edge = input.pointerUp(event.button, performance.now());
  if (phase === "running") {
    updateGoal(performance.now(), edge);
    updateHud();
  }
}
document.addEventListener("mouseup", handleButtonUp);
document.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "mouse") handleButtonUp(event);
});
el("arena").addEventListener("pointercancel", () => {
  if (phase === "running") pause();
  else input.clear();
});
el("arena").addEventListener("contextmenu", (event) => {
  if (phase === "running") event.preventDefault();
});
el("arena").addEventListener("auxclick", (event) => {
  if (phase === "running") event.preventDefault();
});
function pointerBinding(event: MouseEvent) {
  const code =
    ["MOUSE1", "MOUSE3", "MOUSE2", "MOUSE4", "MOUSE5"][event.button] || "";
  return keyFromEvent({
    code,
    key: "",
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
  });
}

type KeyboardCapture = { lock(): Promise<void>; unlock(): void };
const keyboardCapture = (
  navigator as Navigator & { keyboard?: KeyboardCapture }
).keyboard;
function releaseCapture() {
  try {
    keyboardCapture?.unlock();
  } catch {
    /* Optional browser capability. */
  }
  if (document.pointerLockElement) document.exitPointerLock();
}
async function captureMouse() {
  if (phase !== "running" || !has3DRange()) return;
  try {
    await el<HTMLCanvasElement>("range-canvas").requestPointerLock();
    if (phase !== "running") {
      releaseCapture();
      return;
    }
    if (document.fullscreenElement && keyboardCapture) {
      try {
        await keyboardCapture.lock();
      } catch {
        feedback("KEYBOARD CAPTURE UNAVAILABLE. KEEP SAFE CROUCH ON.", false);
      }
    }
  } catch {
    feedback("MOUSE CAPTURE UNAVAILABLE. FREE CURSOR STILL WORKS.", false);
  } finally {
    if (phase === "running") el("arena").focus();
  }
}
el("mouse-look").addEventListener("click", () => {
  if (document.pointerLockElement) pause();
  else void captureMouse();
});
el("fullscreen-button").addEventListener("click", async () => {
  const wasRunning = phase === "running";
  captureTransition = true;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el("arena").requestFullscreen();
    range?.resize();
    if (wasRunning) {
      if (phase === "paused") resume();
      await captureMouse();
    }
  } catch {
    feedback("FULLSCREEN UNAVAILABLE. NORMAL PRACTICE STILL WORKS.", false);
  } finally {
    captureTransition = false;
    if (phase === "running") el("arena").focus();
  }
});
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === el("range-canvas");
  text("mouse-look", locked ? "Release mouse / pause" : "Capture mouse");
  text(
    "range-status",
    locked
      ? "MOUSE LOOK · ESC TO PAUSE / RELEASE"
      : has3DRange()
        ? "FREE CURSOR · ORIGINAL PRACTICE RANGE"
        : "2D FALLBACK · WEBGL UNAVAILABLE",
  );
  if (!locked && !isBasicMode() && phase === "running" && !captureTransition)
    pause();
});
el("range-canvas").addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  if (isBasicMode()) return;
  pause();
  feedback("3D CONTEXT LOST. RELOAD THE PAGE TO RESTORE THE RANGE.", false);
});

const dialog = el<HTMLDialogElement>("bindings-dialog");
function renderBindings() {
  syncKeyboardListeners();
  const list = el("bindings-list");
  list.replaceChildren();
  for (const action of actions(false)) {
    const row = document.createElement("div");
    row.className = "binding-row";
    const label = document.createElement("span");
    label.textContent = action.label;
    const button = document.createElement("button");
    button.className = "key-button";
    button.textContent =
      capture === action.id ? "Press a key..." : displayKey(action.key);
    button.setAttribute(
      "aria-label",
      `Rebind ${action.label}: ${displayKey(action.key)}`,
    );
    button.dataset.binding = action.id;
    button.classList.toggle("capturing", capture === action.id);
    button.addEventListener("mousedown", (event) => {
      if (capture !== action.id) return;
      const key = pointerBinding(event);
      if (!trainableBinding(key)) return;
      event.preventDefault();
      event.stopPropagation();
      finishRebind(key);
    });
    button.addEventListener("click", () => {
      capture = action.id;
      renderBindings();
      text(
        "binding-status",
        `Press a key for ${action.label}. Escape cancels.`,
      );
    });
    row.append(label, button);
    list.append(row);
  }
  if (capture)
    document
      .querySelector<HTMLButtonElement>(`[data-binding="${capture}"]`)
      ?.focus();
}
function openBindings() {
  if (phase === "running" || phase === "paused") return;
  capture = null;
  text("binding-status", "");
  renderBindings();
  dialog.showModal();
}
function closeBindings() {
  capture = null;
  syncKeyboardListeners();
  dialog.close();
}
el("bindings-button").addEventListener("click", openBindings);
el("edit-bindings").addEventListener("click", openBindings);
el("close-bindings").addEventListener("click", closeBindings);
el("done-bindings").addEventListener("click", closeBindings);
dialog.addEventListener("contextmenu", (event) => {
  if (capture) event.preventDefault();
});
dialog.addEventListener("cancel", (event) => {
  if (capture) {
    event.preventDefault();
    capture = null;
    renderBindings();
  }
});
dialog.addEventListener("close", () => {
  capture = null;
  syncKeyboardListeners();
});
el("reset-bindings").addEventListener("click", () => {
  settings.bindings = {};
  capture = null;
  save();
  renderBindings();
  updateSetup();
  text("binding-status", "Default bindings restored.");
});
el("import-bindings").addEventListener("click", () =>
  el<HTMLInputElement>("import-file").click(),
);
el("import-file").addEventListener("change", async () => {
  const input = el<HTMLInputElement>("import-file");
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1_000_000)
      throw new Error("Choose a keybind file smaller than 1 MB.");
    const parsed = parseBindings(await file.text());
    const bindings = Object.fromEntries(
      Object.entries(parsed).filter(([, key]) => trainableBinding(key)),
    );
    if (!Object.keys(bindings).length)
      throw new Error(
        "No usable practice bindings found. Escape, Tab, function keys and system keys are reserved.",
      );
    const skipped = Object.keys(parsed).length - Object.keys(bindings).length;
    settings.bindings = { ...settings.bindings, ...bindings };
    capture = null;
    save();
    renderBindings();
    updateSetup();
    text(
      "binding-status",
      `Imported ${Object.keys(bindings).length} supported bindings.${skipped ? ` Skipped ${skipped} reserved shortcuts.` : ""} Nothing was uploaded or changed in Steam.`,
    );
  } catch (error) {
    text(
      "binding-status",
      error instanceof Error
        ? error.message
        : "Could not read that keybind file.",
    );
  }
  input.value = "";
});
for (const scenario of SCENARIOS) {
  const option = document.createElement("option");
  option.value = scenario.id;
  option.textContent = scenario.title;
  el("scenario").append(option);
}
text("range-status", "3D RANGE LOADS WHEN YOU START");
updateSetup();
showPhase();
window.addEventListener("pagehide", (event) => {
  pause();
  if (!event.persisted) range?.dispose();
});
text(
  "storage-note",
  storageAvailable
    ? "YOUR SETTINGS STAY IN THIS BROWSER."
    : "STORAGE UNAVAILABLE. PROGRESS IS TEMPORARY.",
);
