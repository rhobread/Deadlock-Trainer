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

type Mode = "recall" | "aim" | "mixed";
type Difficulty = "rookie" | "regular" | "sharp";
type Result = {
  mode: Mode;
  hits: number;
  attempts: number;
  median: number;
  duration: number;
  date: string;
};
type Settings = {
  mode: Mode;
  difficulty: Difficulty;
  duration: number;
  hints: boolean;
  group: string;
  bindings: Record<string, string>;
};
const DEFAULTS: Settings = {
  mode: "recall",
  difficulty: "rookie",
  duration: 60,
  hints: true,
  group: "all",
  bindings: {},
};
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
      "Click the glowing souls before they fade. Work on clean, deliberate target acquisition.",
    tag: "02 / THE PRECISION",
  },
  mixed: {
    title: "The pressure test",
    subtitle: "Bring it all together.",
    description:
      "Alternate between keybind prompts and soul targets. Keep your hands ready for the next move.",
    tag: "03 / THE COMBINATION",
  },
};
const LEVELS = {
  rookie: { radius: 29, lifetime: 3200 },
  regular: { radius: 22, lifetime: 2100 },
  sharp: { radius: 15, lifetime: 1400 },
};
const STORAGE = "deadlock-trainer-v1";
function trainableBinding(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Z0-9]+(?:\+[A-Z0-9]+)*$/.test(value) &&
    value.length <= 40 &&
    !value
      .split("+")
      .some(
        (key) => ["ESCAPE", "TAB", "META"].includes(key) || /^F\d+$/.test(key),
      )
  );
}
let settings: Settings = { ...DEFAULTS };
let history: Result[] = [];
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
  if (saved && typeof saved === "object") {
    const s = saved.settings;
    if (s && typeof s === "object") {
      settings = {
        mode: Object.hasOwn(MODES, s.mode) ? s.mode : DEFAULTS.mode,
        difficulty: Object.hasOwn(LEVELS, s.difficulty)
          ? s.difficulty
          : DEFAULTS.difficulty,
        duration: [30, 60, 120].includes(s.duration) ? s.duration : 60,
        hints: typeof s.hints === "boolean" ? s.hints : true,
        group: ["all", "movement", "combat", "abilities", "items"].includes(
          s.group,
        )
          ? s.group
          : "all",
        bindings: Object.fromEntries(
          ACTIONS.filter((a) => trainableBinding(s.bindings?.[a.id])).map(
            (a) => [a.id, s.bindings[a.id]],
          ),
        ),
      };
    }
    if (Array.isArray(saved.history))
      history = saved.history
        .filter(
          (r: Result) =>
            r &&
            Object.hasOwn(MODES, r.mode) &&
            [r.hits, r.attempts, r.median, r.duration].every(
              (n) => Number.isFinite(n) && n >= 0,
            ) &&
            typeof r.date === "string" &&
            Number.isFinite(Date.parse(r.date)),
        )
        .slice(0, 20);
  }
} catch {
  storageAvailable = false;
}

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
let target: { x: number; y: number; radius: number } | null = null;
let task: "key" | "target" = "key";
let taskIndex = 0;
let frame = 0;
let feedbackTimer = 0;
let capture: string | null = null;
let pauseTime = 0;
let lastShownSecond = -1;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <aside class="sidebar">
    <a class="brand" href="./" aria-label="Deadlock Trainer home"><span class="brand-mark">D<span></span></span><span>DEADLOCK<span class="brand-small">TRAINER / EST. 2026</span></span></a>
    <div class="nav-label">YOUR TRAINING GROUND</div>
    <nav aria-label="Training modes">
      <button class="nav-item" data-mode="recall" aria-label="Keybind recall"><span class="nav-icon" aria-hidden="true">⌘</span><span>Keybind recall<small>Build your muscle memory</small></span><span class="nav-number">01</span></button>
      <button class="nav-item" data-mode="aim" aria-label="Soul practice"><span class="nav-icon crosshair-icon" aria-hidden="true"></span><span>Soul practice<small>Dial in your precision</small></span><span class="nav-number">02</span></button>
      <button class="nav-item" data-mode="mixed" aria-label="Mixed training"><span class="nav-icon" aria-hidden="true">↯</span><span>Mixed training<small>Put it all together</small></span><span class="nav-number">03</span></button>
    </nav>
    <div class="sidebar-note"><span class="tiny-star">✳</span><h3>A little practice.<br>A lot more instinct.</h3><p>Five minutes here.<br>One less thing to think about in lane.</p></div>
    <button id="bindings-button" class="bindings-button" aria-label="Your keybinds"><span aria-hidden="true">⚙</span> Your keybinds <span aria-hidden="true">↗</span></button>
    <div class="local-status"><i></i> LOCAL ONLY. ALWAYS.</div>
  </aside>
  <main>
    <header class="topbar"><span>THE WARM-UP ROOM</span><span class="topbar-right"><i></i> NO QUEUE. JUST YOU.</span></header>
    <section class="page-heading"><div><div id="mode-tag" class="eyebrow"></div><h1 id="mode-title"></h1><p id="mode-description"></p></div><div class="edition">PRACTICE MAKES<br><span>SECOND NATURE.</span></div></section>
    <section class="workspace" aria-label="Practice workspace">
      <div class="training-column">
        <div class="arena-header"><span><i></i> <span id="arena-label">READY WHEN YOU ARE</span></span><span><kbd>ESC</kbd> PAUSE</span></div>
        <div id="arena" class="arena" tabindex="-1" aria-label="Training area">
          <div class="arena-grid"></div><div class="arena-corner corner-tl"></div><div class="arena-corner corner-tr"></div><div class="arena-corner corner-bl"></div><div class="arena-corner corner-br"></div>
          <div class="arena-coordinates">DL // TRAINING FACILITY<br>SECTOR 07 - PERSONAL RANGE</div>
          <div id="idle-screen" class="arena-screen"><div class="emblem"><span></span><b>✳</b></div><div class="arena-eyebrow">A GOOD MATCH STARTS HERE</div><h2 id="arena-subtitle"></h2><p id="arena-instructions"></p><button id="start-button" class="primary-button">Start training <span>↗</span></button><span class="arena-footnote">SHORT SESSIONS. LASTING INSTINCTS.</span></div>
          <div id="practice-screen" class="practice-screen" hidden><div class="prompt-category" id="prompt-category"></div><h2 id="prompt-label" aria-live="polite" role="status"></h2><div id="key-hint"></div><p id="prompt-tip"></p></div>
          <button id="soul" class="soul" aria-label="Shoot soul target" hidden><span></span></button>
          <div id="feedback" class="feedback" role="status" aria-live="polite"></div>
          <div id="pause-screen" class="arena-screen overlay" hidden><div class="arena-eyebrow">TAKE A BREATHER</div><h2>On your time.</h2><p>Your session is paused. Pick up where you left off.</p><button id="resume-button" class="primary-button">Resume training <span>↗</span></button><button id="end-button" class="text-button">Finish session early</button></div>
          <div id="result-screen" class="arena-screen overlay" hidden><div class="arena-eyebrow">ANOTHER REP IN THE BOOKS</div><h2>Nice work.</h2><p id="result-copy"></p><div class="result-grid"><div><strong id="result-hits"></strong><span>CORRECT</span></div><div><strong id="result-accuracy"></strong><span>ACCURACY</span></div><div><strong id="result-median"></strong><span>MEDIAN RESPONSE</span></div></div><button id="again-button" class="primary-button">Go again <span>↗</span></button><button id="back-button" class="text-button">Back to setup</button></div>
          <div id="arena-bottom" class="arena-bottom"><span>FOCUS ON ACCURACY. SPEED WILL FOLLOW.</span><span class="arena-reticle">+</span></div>
        </div>
        <div class="session-stats" aria-label="Live session statistics"><div><span>TIME LEFT</span><strong id="stat-time">01:00</strong></div><div><span>CORRECT</span><strong id="stat-hits">00</strong></div><div><span>ACCURACY</span><strong id="stat-accuracy">--<small>%</small></strong></div><div><span>STREAK</span><strong id="stat-streak">00</strong></div><button id="pause-button" class="pause-control" disabled aria-label="Pause session">Ⅱ</button></div>
        <div class="coach-note"><span class="note-icon">↗</span><div><strong>Build the habit, not the high score.</strong><p id="coach-copy">Start with hints on. Once the keys feel familiar, switch them off and trust your hands.</p></div></div>
      </div>
      <aside class="setup-panel"><div class="panel-heading"><h2>Make it your session.</h2><span>↙</span></div><p class="panel-intro">Small adjustments. Better practice.</p>
        <fieldset id="settings-fields"><div class="setting-block"><label for="duration">SESSION LENGTH</label><div class="segmented" id="duration"><button data-duration="30">30s</button><button data-duration="60">60s</button><button data-duration="120">120s</button></div></div>
        <div class="setting-block"><label for="difficulty">DIFFICULTY</label><select id="difficulty"><option value="rookie">Rookie</option><option value="regular">Regular</option><option value="sharp">Sharpshooter</option></select><p id="difficulty-copy"></p></div>
        <div class="setting-block" id="group-setting"><label for="group">PRACTICE FOCUS</label><select id="group"><option value="all">All keybinds</option><option value="movement">Movement</option><option value="combat">Combat & utility</option><option value="abilities">Abilities</option><option value="items">Active items</option></select></div>
        <div class="hint-setting" id="hint-setting"><div><label for="hints">Training wheels</label><p>Show the key with each prompt</p></div><input id="hints" type="checkbox" role="switch" aria-label="Show key hints" /></div></fieldset>
        <div class="quick-reference" id="quick-reference"><div class="reference-heading">YOUR QUICK REFERENCE <button id="edit-bindings" aria-label="Edit keybinds">EDIT ↗</button></div><div id="reference-keys"></div></div>
        <div class="personal-best"><div class="eyebrow">YOUR LAST SESSION</div><div id="last-session"><strong>A fresh start.</strong><p>Your progress starts with one session.</p></div></div>
      </aside>
    </section>
    <section class="bottom-strip"><div><span class="strip-number">01</span><div><strong>Learn the keys.</strong><p>Make the basics automatic.</p></div></div><span class="strip-line"></span><div><span class="strip-number">02</span><div><strong>Find your rhythm.</strong><p>Clean inputs over rushed ones.</p></div></div><span class="strip-line"></span><div><span class="strip-number">03</span><div><strong>Take it to the lane.</strong><p>Less thinking. More playing.</p></div></div></section>
    <footer><span>AN UNOFFICIAL DEADLOCK COMPANION. NOT AFFILIATED WITH VALVE.</span><span id="storage-note">YOUR SETTINGS STAY IN THIS BROWSER.</span></footer>
  </main>
  <dialog id="bindings-dialog" aria-labelledby="bindings-title"><div class="dialog-header"><div><div class="eyebrow">MAKE IT FAMILIAR</div><h2 id="bindings-title">Your keybinds.</h2></div><button id="close-bindings" class="close-button" aria-label="Close keybind settings">×</button></div><p>Click a key, then press your preferred binding. Escape cancels. Changes only affect this trainer.</p><div class="import-row"><button id="import-bindings" class="secondary-button">Import Deadlock .lst ↗</button><input type="file" id="import-file" accept=".lst,.txt" hidden /><button id="reset-bindings" class="text-button">Reset defaults</button></div><p class="import-help">Choose citadelkeys_personal.lst from your Steam userdata / 1422450 / remote / cfg folder. Read locally, never uploaded. Primary bindings only; hero-specific overrides are not imported.</p><div id="binding-status" role="status" aria-live="polite"></div><div id="bindings-list"></div><button id="done-bindings" class="primary-button">All set <span>↗</span></button></dialog>
`;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
function text(id: string, value: string) {
  el(id).textContent = value;
}
function save() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify({ settings, history }));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
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
      ? "Click each soul before it disappears.\nStay relaxed. Make every shot count."
      : settings.mode === "mixed"
        ? "Press the prompted keys. Click the glowing souls.\nOne input at a time. You have this."
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
  el<HTMLInputElement>("hints").checked = settings.hints;
  el("group-setting").hidden = settings.mode === "aim";
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
    settings.mode === "aim"
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
  task =
    settings.mode === "aim" ||
    (settings.mode === "mixed" && taskIndex++ % 2 === 1)
      ? "target"
      : "key";
  promptStarted = now;
  const level = LEVELS[settings.difficulty];
  promptDeadline = now + (task === "key" ? level.lifetime * 2 : level.lifetime);
  if (task === "key") {
    const pool = actions().filter(
      (a) => settings.group === "all" || a.group === settings.group,
    );
    current = chooseAction(pool, current?.id);
    text("prompt-category", `${current.group.toUpperCase()} / PRESS THE KEY`);
    text("prompt-label", current.label);
    el("key-hint").replaceChildren();
    if (settings.hints) {
      const key = document.createElement("kbd");
      key.textContent = displayKey(current.key);
      el("key-hint").append(key);
    } else text("key-hint", "TRUST YOUR HANDS");
    text("prompt-tip", current.tip);
  } else {
    const arena = el("arena");
    const margin = level.radius + 38;
    target = {
      x: margin + Math.random() * Math.max(0, arena.clientWidth - margin * 2),
      y:
        95 +
        Math.random() *
          Math.max(0, arena.clientHeight - 170 - level.radius * 2),
      radius: level.radius,
    };
    const soul = el("soul");
    soul.style.left = `${target.x}px`;
    soul.style.top = `${target.y}px`;
    soul.style.width = soul.style.height = `${target.radius * 2}px`;
    soul.style.setProperty("--lifetime", `${level.lifetime}ms`);
    soul.classList.remove("spawn");
    void soul.offsetWidth;
    soul.classList.add("spawn");
  }
  showPhase();
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
  if (advance) nextTask(now);
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
  changeSetup({ group: el<HTMLSelectElement>("group").value }),
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
    if (
      !key ||
      event.metaKey ||
      key === "ESCAPE" ||
      key === "TAB" ||
      /^F\d+$/.test(key)
    ) {
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
  if (event.ctrlKey || event.metaKey || event.altKey) {
    // Only consume modifier combinations that are explicitly part of the practice pool.
    const key = keyFromEvent(event);
    if (!actions().some((a) => a.key === key)) return;
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
  if (key && current) record(key === current.key, now, key === current.key);
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
  const success =
    Math.hypot(
      event.clientX - rect.left - el("arena").clientLeft - target.x,
      event.clientY - rect.top - el("arena").clientTop - target.y,
    ) <= target.radius;
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
updateSetup();
showPhase();
text(
  "storage-note",
  storageAvailable
    ? "YOUR SETTINGS STAY IN THIS BROWSER."
    : "STORAGE UNAVAILABLE. PROGRESS IS TEMPORARY.",
);
