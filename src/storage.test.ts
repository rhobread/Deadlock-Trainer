import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  loadState,
  saveState,
  trainableBinding,
  type Result,
} from "./storage";

function load(value: unknown) {
  return loadState({ getItem: () => JSON.stringify(value) });
}

const result: Result = {
  mode: "recall",
  hits: 3,
  attempts: 5,
  median: 240,
  duration: 30,
  date: "2026-11-15T02:44:06.000Z",
};

test("missing state returns independent settings, bindings, and history", () => {
  const first = loadState({
    getItem: (key) => {
      assert.equal(key, STORAGE_KEY);
      return null;
    },
  });
  const second = load(null);
  assert.deepEqual(first.settings, DEFAULT_SETTINGS);
  assert.equal(first.history.length, 0);
  assert.equal(first.storageAvailable, true);
  assert.notEqual(first.settings, DEFAULT_SETTINGS);
  assert.notEqual(first.settings.bindings, DEFAULT_SETTINGS.bindings);
  first.settings.bindings.Reload = "T";
  first.history.push(result);
  first.settings.mode = "aim";
  assert.deepEqual(second.settings, DEFAULT_SETTINGS);
  assert.deepEqual(second.history, []);
});

test("blocked storage and unavailable localStorage return temporary defaults", () => {
  for (const storage of [
    null,
    {
      getItem: () => {
        throw new Error("blocked");
      },
    },
  ]) {
    assert.deepEqual(loadState(storage), {
      settings: DEFAULT_SETTINGS,
      history: [],
      storageAvailable: false,
    });
  }
});

test("corrupt JSON and invalid root shapes do not mark readable storage unavailable", () => {
  const corrupt = loadState({ getItem: () => "{not json" });
  assert.deepEqual(corrupt, {
    settings: DEFAULT_SETTINGS,
    history: [],
    storageAvailable: true,
  });
  for (const value of [
    null,
    [],
    true,
    42,
    "text",
    { settings: [], history: {} },
  ]) {
    assert.deepEqual(load(value), corrupt);
  }
});

test("partial legacy settings preserve valid fields and default missing scenario", () => {
  assert.deepEqual(
    load({
      settings: {
        mode: "mixed",
        duration: 120,
        hints: false,
        group: "combat",
        bindings: { Reload: "T" },
      },
    }).settings,
    {
      ...DEFAULT_SETTINGS,
      mode: "mixed",
      duration: 120,
      hints: false,
      group: "combat",
      bindings: { Reload: "T" },
      scenario: "all",
    },
  );
  assert.deepEqual(
    load({
      settings: {
        mode: "constructor",
        difficulty: "toString",
        duration: "30",
        hints: 0,
        group: "__proto__",
        scenario: "constructor",
        bindings: "Reload",
      },
    }).settings,
    DEFAULT_SETTINGS,
  );
  for (const duration of [0, -1, 31, null])
    assert.equal(load({ settings: { duration } }).settings.duration, 60);
  for (const difficulty of ["rookie", "regular", "sharp"])
    assert.equal(
      load({ settings: { difficulty } }).settings.difficulty,
      difficulty,
    );
  for (const scenario of [
    "all",
    "secure",
    "deny",
    "parry",
    "dash-jump",
    "reload",
    "strafe",
  ])
    assert.equal(load({ settings: { scenario } }).settings.scenario, scenario);
});

test("binding dictionaries ignore prototype names and nonexistent actions", () => {
  const bindings: unknown = JSON.parse(
    '{"__proto__":{"Reload":"X"},"constructor":"Q","toString":"W","UnknownAction":"E","Reload":"T"}',
  );
  const settings = load({ settings: { bindings } }).settings;
  assert.deepEqual(settings.bindings, { Reload: "T" });
  assert.equal(Object.hasOwn(settings.bindings, "__proto__"), false);
  assert.equal(Object.getPrototypeOf(settings.bindings), Object.prototype);
});

test("trainable bindings must be supported normalized keys or canonical combinations", () => {
  for (const value of [
    "A",
    "0",
    "SPACE",
    "CTRL",
    "ALT",
    "SHIFT",
    "ARROWUP",
    "SEMICOLON",
    "NUMPAD1",
    "CTRL+R",
    "ALT+SHIFT+SPACE",
    "CTRL+ALT+SHIFT+Q",
    "CTRL+ALT",
    "CTRL+ALT+SHIFT",
    "MOUSE1",
    "MOUSE2",
    "SHIFT+MOUSE4",
  ])
    assert.equal(trainableBinding(value), true, value);
  for (const value of [
    null,
    1,
    {},
    "",
    "AAA",
    "a",
    "KeyA",
    "UP",
    "CONTROL",
    " A",
    "A ",
    "ESCAPE",
    "TAB",
    "META",
    "F1",
    "F24",
    "F25",
    "CTRL+F1",
    "SHIFT+TAB",
    "META+Q",
    "CTRL+ESCAPE",
    "CTRL+META+Q",
    "CTRL+AAA",
    "A+B",
    "A+CTRL",
    "SHIFT+CTRL+Q",
    "CTRL+CTRL+Q",
    "CTRL++Q",
    "+A",
    "A+",
    "CTRL+SHIFT+ALT",
  ])
    assert.equal(trainableBinding(value), false, String(value));
  assert.deepEqual(
    load({
      settings: {
        bindings: {
          Reload: "AAA",
          HeldItem: "CTRL+F1",
          Ability1: "1",
          Roll: "SHIFT",
        },
      },
    }).settings.bindings,
    { Ability1: "1", Roll: "SHIFT" },
  );
});

test("combat settings validate safety, mouse look, and new scenario selections", () => {
  assert.equal(
    load({
      settings: { scenario: "dash-slide", safeCrouch: false, sensitivity: 1.5 },
    }).settings.scenario,
    "dash-slide",
  );
  assert.equal(
    load({ settings: { safeCrouch: false } }).settings.safeCrouch,
    false,
  );
  assert.equal(
    load({ settings: { sensitivity: 1.5 } }).settings.sensitivity,
    1.5,
  );
  assert.equal(load({ settings: { sensitivity: 99 } }).settings.sensitivity, 1);
  assert.equal(
    load({ settings: { safeCrouch: "false" } }).settings.safeCrouch,
    true,
  );
  assert.deepEqual(
    load({ settings: { bindings: { Attack: "MOUSE4", ADS: "ALT+MOUSE2" } } })
      .settings.bindings,
    { Attack: "MOUSE4", ADS: "ALT+MOUSE2" },
  );
});

test("invalid result shapes, counts, durations, medians, and dates are discarded", () => {
  const invalid = [
    null,
    [],
    "result",
    {},
    ...[
      { mode: "constructor" },
      { hits: -1 },
      { attempts: -1 },
      { hits: 6 },
      { hits: 0.5 },
      { attempts: 5.5 },
      { hits: "3" },
      { attempts: null },
      { hits: Infinity },
      { attempts: Infinity },
      { median: Infinity },
      { median: NaN },
      { median: -1 },
      { median: "240" },
      { duration: -1 },
      { duration: 121 },
      { duration: Infinity },
      { duration: "30" },
      { date: 0 },
      { date: "yesterday" },
      { date: "11/15/2026" },
      { date: "2026-02-30T00:00:00.000Z" },
      { date: "2026-11-15T24:00:00Z" },
    ].map((change) => ({ ...result, ...change })),
  ];
  const valid = [
    result,
    { ...result, hits: 0, attempts: 0, median: 0, duration: 0 },
    {
      ...result,
      mode: "aim",
      duration: 120,
      date: "2024-02-29T01:00:00+01:00",
    },
    { ...result, mode: "mixed", duration: 0.5, date: "2026-11-15T02:44:06Z" },
  ];
  assert.deepEqual(load({ history: [...invalid, ...valid] }).history, valid);
});

test("history retains the first 20 valid results in existing newest-first order", () => {
  const history = Array.from({ length: 25 }, (_, index) => ({
    ...result,
    median: index,
  }));
  assert.deepEqual(
    load({ history: [null, ...history] }).history,
    history.slice(0, 20),
  );
});

test("saveState returns false for unavailable or failing storage", () => {
  assert.equal(saveState(null, DEFAULT_SETTINGS, []), false);
  assert.equal(
    saveState(
      {
        setItem: () => {
          throw new Error("quota");
        },
      },
      DEFAULT_SETTINGS,
      [],
    ),
    false,
  );
});

test("saveState writes the v1 envelope, caps history, and round-trips settings", () => {
  let written = "";
  const settings = {
    ...DEFAULT_SETTINGS,
    scenario: "parry",
    bindings: { HeldItem: "CTRL+Q" },
  };
  const history = Array.from({ length: 25 }, (_, median) => ({
    ...result,
    median,
  }));
  assert.equal(
    saveState(
      {
        setItem: (key, value) => {
          assert.equal(key, STORAGE_KEY);
          written = value;
        },
      },
      settings,
      history,
    ),
    true,
  );
  assert.deepEqual(JSON.parse(written), {
    settings,
    history: history.slice(0, 20),
  });
  assert.deepEqual(loadState({ getItem: () => written }), {
    settings,
    history: history.slice(0, 20),
    storageAvailable: true,
  });
  assert.equal(history.length, 25);
});
