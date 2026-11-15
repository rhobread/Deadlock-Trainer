import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./style.css";
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
  bindingIsHeld,
  chooseScenario,
  matchesAction,
  physicalKey,
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
const MODES = {
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
    title: "Lane situations",
    subtitle: "Bring it all together.",
    description:
      "Read a lane situation, then make the inputs: parry, dash-jump, reload behind cover, or contest a soul.",
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
let task: "key" | "target" = "key";
let taskIndex = 0;
let scenario: Scenario | null = null;
let scenarioStep = 0;
let previousScenarioId: string | undefined;
let step: DrillStep | null = null;
const heldKeys = new Set<string>();
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
function save() {
  storageAvailable = saveState(storage, settings, history);
  text(
    "storage-note",
    storageAvailable
      ? "YOUR SETTINGS STAY IN THIS BROWSER."
      : "STORAGE UNAVAILABLE. PROGRESS IS TEMPORARY.",
  );
}
function actions() {
  return ACTIONS.map((a) => ({ ...a, key: settings.bindings[a.id] || a.key }));
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
}
function updateSetup() {
  const mode = MODES[settings.mode];
  text("mode-tag", mode.tag);
  text("mode-title", mode.title + ".");
  text("mode-description", mode.description);
  text("arena-subtitle", mode.subtitle);
  text(
    "arena-instructions",
    settings.mode === "aim"
      ? "Souls rise after a ranged last hit.\nFind them, then click before they fade."
      : settings.mode === "mixed"
        ? "Read the situation. Rehearse the inputs in order.\nGame timing and movement belong in the sandbox."
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
  el("group-setting").hidden = settings.mode !== "recall";
  el("scenario-setting").hidden = settings.mode !== "mixed";
  el("hint-setting").hidden = settings.mode === "aim";
  text(
    "difficulty-copy",
    settings.difficulty === "rookie"
      ? "Bigger targets. More time to find your feet."
      : settings.difficulty === "regular"
        ? "Smaller targets. A little more urgency."
        : "Tiny targets. Quick decisions. Stay sharp.",
  );
  text(
    "coach-copy",
    settings.mode === "mixed"
      ? "Situations rehearse input order and hand coordination. They do not simulate parry windows, collision, stamina, or a hero's abilities. Finish in the game sandbox."
      : settings.mode === "aim"
        ? "A 2D mouse warm-up, not an in-game sensitivity match. Use your usual mouse DPI; finish with a few minutes in the sandbox."
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
  el("practice-screen").hidden = phase !== "running" || task !== "key";
  el("soul").hidden = phase !== "running" || task !== "target";
  el("target-context").hidden = phase !== "running" || task !== "target";
  el("situation-banner").hidden =
    phase !== "running" || settings.mode !== "mixed";
  el("arena-bottom").hidden = phase === "running";
  el<HTMLButtonElement>("pause-button").disabled = phase !== "running";
  el<HTMLFieldSetElement>("settings-fields").disabled =
    phase === "running" || phase === "paused";
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((b) => (b.disabled = phase === "running" || phase === "paused"));
  el<HTMLButtonElement>("bindings-button").disabled =
    phase === "running" || phase === "paused";
  el<HTMLButtonElement>("edit-bindings").disabled =
    phase === "running" || phase === "paused";
  text(
    "arena-label",
    phase === "running"
      ? "SESSION IN PROGRESS"
      : phase === "paused"
        ? "SESSION PAUSED"
        : phase === "finished"
          ? "SESSION COMPLETE"
          : "READY WHEN YOU ARE",
  );
  el("arena").classList.toggle("is-running", phase === "running");
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
  } else task = settings.mode === "aim" ? "target" : "key";
  promptStarted = now;
  const level = LEVELS[settings.difficulty];
  promptDeadline = now + (task === "key" ? level.lifetime * 2 : level.lifetime);
  if (task === "key") {
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
    const kind =
      step?.kind === "target"
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
    const soul = el("soul");
    soul.dataset.kind = kind;
    soul.setAttribute(
      "aria-label",
      kind === "trooper" ? "Shoot trooper target" : "Shoot soul target",
    );
    text(
      "target-label",
      kind === "trooper"
        ? "Land the ranged last hit"
        : kind === "secure"
          ? "Secure your soul"
          : "Deny the enemy soul",
    );
    text(
      "target-tip",
      step?.cue ||
        (kind === "secure"
          ? "Your ranged last hit released this soul. Shoot to secure it."
          : "The enemy's ranged last hit released this soul. Shoot to deny it."),
    );
    const holdAction = requiredMovement();
    text(
      "hold-hint",
      holdAction
        ? settings.hints
          ? `HOLD ${displayKey(holdAction.key)} WHILE SHOOTING`
          : `KEEP ${holdAction.label.toUpperCase()} HELD WHILE SHOOTING`
        : "LEFT CLICK / APPROXIMATE BROWSER MOTION",
    );
    soul.style.width = soul.style.height = `${target.radius * 2}px`;
    renderTarget(now);
  }
  showPhase();
}
function arenaBounds() {
  return { width: el("arena").clientWidth, height: el("arena").clientHeight };
}
function targetElapsed(now: number) {
  return reducedMotion.matches ? 0 : now - promptStarted;
}
function requiredMovement() {
  const actionId = step?.kind === "target" ? step.holdActionId : undefined;
  return actionId
    ? actions().find((action) => action.id === actionId)
    : undefined;
}
function renderTarget(now: number) {
  if (!target || task !== "target") return;
  const position = targetPosition(target, targetElapsed(now), arenaBounds());
  el("soul").style.left = `${position.x}px`;
  el("soul").style.top = `${position.y}px`;
  const progress = Math.min(
    1,
    (now - promptStarted) / (promptDeadline - promptStarted),
  );
  el("soul").style.opacity = String(1 - progress * 0.4);
  const holdAction = requiredMovement();
  el("hold-hint").classList.toggle(
    "is-held",
    !!holdAction && bindingIsHeld(holdAction.key, heldKeys),
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
  remaining = Math.max(0, deadline - now);
  if (remaining <= 0) {
    finish();
    return;
  }
  if (Math.ceil(remaining / 1000) !== lastShownSecond) {
    lastShownSecond = Math.ceil(remaining / 1000);
    stats();
  }
  if (now >= promptDeadline) record(false, now);
  renderTarget(now);
  frame = requestAnimationFrame(tick);
}
function start() {
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
  heldKeys.clear();
  lastShownSecond = -1;
  remaining = settings.duration * 1000;
  deadline = performance.now() + remaining;
  phase = "running";
  nextTask(performance.now());
  stats();
  el("arena").focus();
  frame = requestAnimationFrame(tick);
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
  heldKeys.clear();
  cancelAnimationFrame(frame);
  clearTimeout(feedbackTimer);
  text("feedback", "");
  showPhase();
  el("resume-button").focus();
}
function resume() {
  if (phase !== "paused") return;
  const now = performance.now();
  const pausedFor = now - pauseTime;
  deadline = now + remaining;
  promptStarted += pausedFor;
  promptDeadline += pausedFor;
  phase = "running";
  showPhase();
  el("arena").focus();
  frame = requestAnimationFrame(tick);
}
function finish() {
  cancelAnimationFrame(frame);
  phase = "finished";
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
  if (phase === "running" || phase === "paused") return;
  settings = { ...settings, ...change };
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
  if (phase === "running") pause();
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
  heldKeys.delete(physicalKey(event));
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
  heldKeys.add(physicalKey(event));
  if (event.key === "Escape") {
    event.preventDefault();
    pause();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    // Leave browser shortcuts alone unless this input belongs to the current drill.
    const key = keyFromEvent(event);
    const expected =
      task === "key" &&
      current &&
      matchesAction(event, current, settings.mode === "mixed");
    if (!expected && !actions().some((a) => a.key === key)) return;
  }
  event.preventDefault();
  if (event.repeat || task !== "key") return;
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
el("arena").addEventListener("pointerdown", (event) => {
  if (phase !== "running" || task !== "target" || event.button !== 0 || !target)
    return;
  event.preventDefault();
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
  const rect = el("arena").getBoundingClientRect();
  const holdAction = requiredMovement();
  if (holdAction && !bindingIsHeld(holdAction.key, heldKeys)) {
    record(false, now, false);
    feedback(
      `KEEP ${settings.hints ? displayKey(holdAction.key) : holdAction.label} HELD WHILE SHOOTING.`,
      false,
    );
    return;
  }
  const success = targetContains(
    target,
    targetElapsed(now),
    arenaBounds(),
    event.clientX - rect.left - el("arena").clientLeft,
    event.clientY - rect.top - el("arena").clientTop,
  );
  record(success, now, success);
});

const dialog = el<HTMLDialogElement>("bindings-dialog");
function renderBindings() {
  syncKeyboardListeners();
  const list = el("bindings-list");
  list.replaceChildren();
  for (const action of actions()) {
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
updateSetup();
showPhase();
text(
  "storage-note",
  storageAvailable
    ? "YOUR SETTINGS STAY IN THIS BROWSER."
    : "STORAGE UNAVAILABLE. PROGRESS IS TEMPORARY.",
);
