import { ACTIONS, keyFromEvent, type Action } from "./trainer";
import { SCENARIOS } from "./drills";

export type Mode =
  | "basic-keys"
  | "basic-aim"
  | "basic-mixed"
  | "recall"
  | "aim"
  | "mixed";
export type Difficulty = "rookie" | "regular" | "sharp";
export type Settings = {
  mode: Mode;
  difficulty: Difficulty;
  duration: number;
  hints: boolean;
  group: "all" | Action["group"];
  bindings: Record<string, string>;
  scenario: string;
  safeCrouch: boolean;
  sensitivity: number;
};
export type Result = {
  mode: Mode;
  hits: number;
  attempts: number;
  median: number;
  duration: number;
  date: string;
};

export const STORAGE_KEY = "deadlock-trainer-v1";
export const DEFAULT_SETTINGS: Settings = {
  mode: "basic-keys",
  difficulty: "rookie",
  duration: 60,
  hints: true,
  group: "all",
  bindings: {},
  scenario: "all",
  safeCrouch: true,
  sensitivity: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMode(value: unknown): value is Mode {
  return (
    typeof value === "string" &&
    [
      "basic-keys",
      "basic-aim",
      "basic-mixed",
      "recall",
      "aim",
      "mixed",
    ].includes(value)
  );
}

export function trainableBinding(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const keys = value.split("+");
  if (
    keys.some(
      (key) => ["ESCAPE", "TAB", "META"].includes(key) || /^F\d+$/.test(key),
    )
  )
    return false;
  return (
    keyFromEvent({
      code: keys[keys.length - 1]!,
      key: "",
      ctrlKey: keys.includes("CTRL"),
      altKey: keys.includes("ALT"),
      shiftKey: keys.includes("SHIFT"),
      metaKey: false,
    }) === value && value !== ""
  );
}

function isIsoDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  // Date.parse normalizes impossible calendar dates, such as February 30.
  const day = value.slice(0, 10);
  return new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) === day;
}

function isResult(value: unknown): value is Result {
  return (
    isRecord(value) &&
    isMode(value.mode) &&
    typeof value.hits === "number" &&
    Number.isInteger(value.hits) &&
    value.hits >= 0 &&
    typeof value.attempts === "number" &&
    Number.isInteger(value.attempts) &&
    value.attempts >= value.hits &&
    typeof value.median === "number" &&
    Number.isFinite(value.median) &&
    value.median >= 0 &&
    typeof value.duration === "number" &&
    Number.isFinite(value.duration) &&
    value.duration >= 0 &&
    value.duration <= 120 &&
    isIsoDate(value.date)
  );
}

export function loadState(storage: Pick<Storage, "getItem"> | null): {
  settings: Settings;
  history: Result[];
  storageAvailable: boolean;
} {
  const settings: Settings = { ...DEFAULT_SETTINGS, bindings: {} };
  const fresh = { settings, history: [] as Result[], storageAvailable: true };
  let raw: string | null;
  try {
    if (!storage) return { ...fresh, storageAvailable: false };
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ...fresh, storageAvailable: false };
  }

  let saved: unknown;
  try {
    saved = JSON.parse(raw ?? "null");
  } catch {
    return fresh;
  }
  if (!isRecord(saved)) return fresh;
  const s = saved.settings;
  if (isRecord(s)) {
    if (isMode(s.mode)) settings.mode = s.mode;
    if (
      s.difficulty === "rookie" ||
      s.difficulty === "regular" ||
      s.difficulty === "sharp"
    )
      settings.difficulty = s.difficulty;
    if (s.duration === 30 || s.duration === 60 || s.duration === 120)
      settings.duration = s.duration;
    if (typeof s.hints === "boolean") settings.hints = s.hints;
    if (
      s.group === "all" ||
      s.group === "movement" ||
      s.group === "combat" ||
      s.group === "abilities" ||
      s.group === "items"
    )
      settings.group = s.group;
    if (
      typeof s.scenario === "string" &&
      (s.scenario === "all" ||
        SCENARIOS.some((scenario) => scenario.id === s.scenario))
    )
      settings.scenario = s.scenario;
    if (typeof s.safeCrouch === "boolean") settings.safeCrouch = s.safeCrouch;
    if (
      typeof s.sensitivity === "number" &&
      Number.isFinite(s.sensitivity) &&
      s.sensitivity >= 0.25 &&
      s.sensitivity <= 2
    )
      settings.sensitivity = s.sensitivity;
    if (isRecord(s.bindings)) {
      for (const { id } of ACTIONS) {
        if (Object.hasOwn(s.bindings, id) && trainableBinding(s.bindings[id]))
          settings.bindings[id] = s.bindings[id];
      }
    }
  }
  return {
    settings,
    history: Array.isArray(saved.history)
      ? saved.history.filter(isResult).slice(0, 20)
      : [],
    storageAvailable: true,
  };
}

export function saveState(
  storage: Pick<Storage, "setItem"> | null,
  settings: Settings,
  history: Result[],
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ settings, history: history.slice(0, 20) }),
    );
    return true;
  } catch {
    return false;
  }
}
