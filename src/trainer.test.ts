import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIONS,
  accuracy,
  chooseAction,
  displayKey,
  keyFromEvent,
  parseBindings,
  summarize,
} from "./trainer.ts";
import type { Action } from "./trainer.ts";

function event(
  code: string,
  overrides: Partial<Parameters<typeof keyFromEvent>[0]> = {},
): Parameters<typeof keyFromEvent>[0] {
  return {
    code,
    key: "",
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides,
  };
}

describe("ACTIONS", () => {
  it("contains exactly the observed keyboard defaults, without mouse actions", () => {
    assert.deepEqual(
      Object.fromEntries(ACTIONS.map(({ id, key }) => [id, key])),
      {
        MoveForward: "W",
        MoveBackwards: "S",
        MoveLeft: "A",
        MoveRight: "D",
        Mantle: "SPACE",
        Roll: "SHIFT",
        Crouch: "CTRL",
        AbilityMelee: "Q",
        HeldItem: "F",
        Reload: "R",
        Interact: "E",
        Ability1: "1",
        Ability2: "2",
        Ability3: "3",
        Ability4: "4",
        Item1: "Z",
        Item2: "X",
        Item3: "C",
        Item4: "V",
      },
    );
    assert.equal(ACTIONS.length, 19);
    assert.equal(ACTIONS.find(({ id }) => id === "HeldItem")?.label, "Parry");
    for (const action of ACTIONS) {
      assert.ok(action.label && action.tip);
      assert.ok(
        ["movement", "combat", "abilities", "items"].includes(action.group),
      );
    }
  });
});

describe("keyFromEvent", () => {
  it("uses physical codes rather than layout-dependent or shifted characters", () => {
    assert.equal(keyFromEvent(event("KeyQ", { key: "a" })), "Q");
    assert.equal(
      keyFromEvent(event("Digit1", { key: "!", shiftKey: true })),
      "SHIFT+1",
    );
    assert.equal(keyFromEvent(event("Space", { key: " " })), "SPACE");
    assert.equal(keyFromEvent(event("ArrowLeft")), "ARROWLEFT");
    assert.equal(keyFromEvent(event("F12")), "F12");
    assert.equal(keyFromEvent(event("Numpad1")), "NUMPAD1");
    assert.equal(keyFromEvent(event("Semicolon", { key: ":" })), "SEMICOLON");
  });

  it("normalizes left and right modifier keys without duplicating themselves", () => {
    for (const [code, key, flag] of [
      ["ShiftLeft", "SHIFT", "shiftKey"],
      ["ShiftRight", "SHIFT", "shiftKey"],
      ["ControlLeft", "CTRL", "ctrlKey"],
      ["ControlRight", "CTRL", "ctrlKey"],
      ["AltLeft", "ALT", "altKey"],
      ["AltRight", "ALT", "altKey"],
      ["MetaLeft", "META", "metaKey"],
      ["MetaRight", "META", "metaKey"],
    ] as const) {
      assert.equal(keyFromEvent(event(code, { [flag]: true })), key);
      assert.equal(keyFromEvent(event(code)), key);
    }
  });

  it("preserves modifier combinations in a consistent order", () => {
    assert.equal(keyFromEvent(event("KeyQ", { ctrlKey: true })), "CTRL+Q");
    assert.equal(keyFromEvent(event("Digit1", { altKey: true })), "ALT+1");
    assert.equal(keyFromEvent(event("KeyQ", { shiftKey: true })), "SHIFT+Q");
    assert.equal(keyFromEvent(event("KeyQ", { metaKey: true })), "META+Q");
    assert.equal(
      keyFromEvent(
        event("KeyQ", {
          ctrlKey: true,
          altKey: true,
          shiftKey: true,
          metaKey: true,
        }),
      ),
      "CTRL+ALT+SHIFT+META+Q",
    );
    assert.equal(
      keyFromEvent(event("ShiftRight", { ctrlKey: true, shiftKey: true })),
      "CTRL+SHIFT",
    );
  });

  it("falls back to key when code is unavailable and rejects unknown keys", () => {
    assert.equal(keyFromEvent(event("", { key: "q" })), "Q");
    assert.equal(keyFromEvent(event("Unidentified", { key: " " })), "SPACE");
    assert.equal(
      keyFromEvent(event("", { key: "Control", ctrlKey: true })),
      "CTRL",
    );
    assert.equal(
      keyFromEvent(event("Unidentified", { key: "Unidentified" })),
      "",
    );
    assert.equal(keyFromEvent(event("Mouse1", { ctrlKey: true })), "");
  });
});

describe("displayKey", () => {
  it("formats names, punctuation and combinations without changing ordinary keys", () => {
    for (const [input, output] of [
      ["SPACE", "Space"],
      ["SHIFT", "Shift"],
      ["CTRL", "Ctrl"],
      ["ALT", "Alt"],
      ["META", "Meta"],
      ["CTRL+SHIFT+Q", "Ctrl+Shift+Q"],
      ["ALT+1", "Alt+1"],
      ["ARROWLEFT", "Left"],
      ["PAGEUP", "Page Up"],
      ["SEMICOLON", ";"],
      ["Q", "Q"],
      ["1", "1"],
      ["F12", "F12"],
      ["", ""],
      ["__proto__", "__proto__"],
    ])
      assert.equal(displayKey(input!), output);
  });
});

describe("parseBindings", () => {
  it("reads quoted real-format action blocks under the Valve root", () => {
    assert.deepEqual(
      parseBindings(`
      "KeyBindings"
      {
        "MoveForward" { "Key" "w" "Modifier" "NONE" }
        "MoveBackwards" { "Key" "s" }
        "Mantle" { "Key" "SPACE" "Modifier" "NONE" }
        "Roll" { "Key" "LSHIFT" }
        "Crouch" { "Key" "LCTRL" }
        "AbilityMelee" { "Key" "q" "Modifier" "CTRL" }
        "HeldItem" { "Key" "f" }
        "Ability1" { "Key" "1" "Modifier" "ALT" }
        "Item1" { "Key" "z" "Modifier" "SHIFT" }
        "Attack" { "Key" "MOUSE1" }
      }
    `),
      {
        MoveForward: "W",
        MoveBackwards: "S",
        Mantle: "SPACE",
        Roll: "SHIFT",
        Crouch: "CTRL",
        AbilityMelee: "CTRL+Q",
        HeldItem: "F",
        Ability1: "ALT+1",
        Item1: "SHIFT+Z",
      },
    );
  });

  it("reads all supported actions and round-trips event-normalized bindings", () => {
    const source = ACTIONS.map(
      ({ id, key }) => `"${id}" { "Key" "${key}" }`,
    ).join("\n");
    assert.deepEqual(
      parseBindings(source),
      Object.fromEntries(ACTIONS.map(({ id, key }) => [id, key])),
    );
    const parsed = parseBindings(
      'AbilityMelee { Key KEY_Q Modifier "SHIFT+CTRL+META" }',
    );
    assert.equal(
      parsed.AbilityMelee,
      keyFromEvent(
        event("KeyQ", { ctrlKey: true, shiftKey: true, metaKey: true }),
      ),
    );
  });

  it("supports comments, unquoted tokens, arbitrary nesting and mixed-case field names", () => {
    assert.deepEqual(
      parseBindings(`
      // AbilityMelee { Key x }
      Root { Nested {
        /* { "MoveForward" { "Key" "x" } } */
        MoveForward { kEy KeyW mOdIfIeR none Note "braces { } and // are text" }
        Reload { Key KEY_R Modifier RSHIFT }
        Interact { Key RETURN Modifier LALT }
      } }
    `),
      { MoveForward: "W", Reload: "SHIFT+R", Interact: "ALT+ENTER" },
    );
  });

  it("uses valid secondary binds only when the primary cannot be used", () => {
    assert.deepEqual(
      parseBindings(`
      MoveForward { Key NONE Key2 UP Modifier2 CTRL }
      MoveBackwards { Key MOUSE2 Key2 S }
      MoveLeft { Key A Key2 LEFT Modifier2 ALT }
      MoveRight { Key NONE Key2 NONE }
      Reload { Key R Modifier INVALID Key2 F5 Modifier2 META }
      Mantle { Key SPACE Modifier NONE Key2 J }
      Ability1 { Key JOY1 }
      Attack { Key Q }
    `),
      {
        MoveForward: "CTRL+ARROWUP",
        MoveBackwards: "S",
        MoveLeft: "A",
        Reload: "META+F5",
        Mantle: "SPACE",
      },
    );
  });

  it("normalizes aliases, modifier-only binds, punctuation and duplicate blocks", () => {
    assert.deepEqual(
      parseBindings(`
      Roll { Key RSHIFT Modifier SHIFT }
      Crouch { Key ControlRight Modifier ALT }
      Interact { Key ";" }
      AbilityMelee { Key Q }
      AbilityMelee { Key E Modifier CTRL }
      AbilityMelee { Key NONE }
    `),
      {
        Roll: "SHIFT",
        Crouch: "CTRL+ALT",
        Interact: "SEMICOLON",
        AbilityMelee: "CTRL+E",
      },
    );
  });

  it("rejects empty input, unsupported actions, invalid keys and unbound configs", () => {
    for (const source of [
      "",
      "  \n ",
      "// only a comment",
      '"KeyBindings" {}',
      "Attack { Key MOUSE1 }",
      "MoveForward { Key NONE }",
      "MoveForward { Key MOUSE1 Key2 JOY1 }",
      "MoveForward { Key MadeUpKey }",
      "MoveForward { Key W Modifier MOUSE1 }",
      "Unknown { Key W }",
    ])
      assert.throws(
        () => parseBindings(source),
        /No supported valid keyboard bindings/,
      );
  });

  it("rejects malformed input even when a valid block precedes it", () => {
    for (const suffix of [
      "}",
      "Root {",
      "orphan",
      "Root { Key }",
      '"unterminated',
      "/* unterminated",
      "{ }",
    ]) {
      assert.throws(
        () => parseBindings(`MoveForward { Key W } ${suffix}`),
        /bindings/i,
      );
    }
  });

  it("treats malicious strings and prototype names only as data", () => {
    assert.deepEqual(
      parseBindings(`
      "__proto__" { "Key" "W" "polluted" "true" }
      "constructor" { "Key" "Q" }
      MoveForward { Key W Note "globalThis.polluted = true; { }" }
      AbilityMelee { Key "Q; process.exit(1)" }
    `),
      { MoveForward: "W" },
    );
    assert.equal(
      Object.getPrototypeOf(parseBindings("MoveForward { Key W }")),
      Object.prototype,
    );
    assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
  });

  it("handles deeply nested input without recursive stack overflow", () => {
    assert.deepEqual(
      parseBindings(
        "Root {".repeat(5000) + "MoveForward { Key W }" + "}".repeat(5000),
      ),
      { MoveForward: "W" },
    );
  });
});

describe("chooseAction", () => {
  const actions: Action[] = ACTIONS.slice(0, 3);

  it("throws for empty input", () => {
    assert.throws(() => chooseAction([]), /empty/i);
  });

  it("uses the supplied random source and includes the first and last candidates", () => {
    assert.equal(
      chooseAction(actions, undefined, () => 0),
      actions[0],
    );
    assert.equal(
      chooseAction(actions, undefined, () => 0.5),
      actions[1],
    );
    assert.equal(
      chooseAction(actions, undefined, () => 0.99999),
      actions[2],
    );
    assert.equal(
      chooseAction(actions, "missing", () => 0),
      actions[0],
    );
  });

  it("never immediately repeats an ID when an alternative exists, without mutating input", () => {
    const original = [...actions];
    for (const previous of actions) {
      for (const sample of [0, 0.25, 0.5, 0.75, 0.99999]) {
        assert.notEqual(
          chooseAction(actions, previous.id, () => sample).id,
          previous.id,
        );
      }
    }
    assert.deepEqual(actions, original);
    const duplicates = [actions[0]!, { ...actions[0]! }, actions[1]!];
    assert.equal(
      chooseAction(duplicates, actions[0]!.id, () => 0),
      actions[1],
    );
  });

  it("allows repeats when only the previous ID is available", () => {
    assert.equal(chooseAction([actions[0]!], actions[0]!.id), actions[0]);
    assert.equal(
      chooseAction([actions[0]!], undefined, () => 0),
      actions[0],
    );
  });

  it("returns a valid action even for out-of-range or nonfinite injected randomness", () => {
    for (const sample of [-1, 1, 2, NaN, Infinity]) {
      assert.ok(
        actions.includes(chooseAction(actions, undefined, () => sample)),
      );
    }
  });
});

describe("statistics", () => {
  it("calculates rounded percentage accuracy and handles zero attempts", () => {
    assert.equal(accuracy(0, 0), 0);
    assert.equal(accuracy(0, 5), 0);
    assert.equal(accuracy(1, 3), 33);
    assert.equal(accuracy(2, 3), 67);
    assert.equal(accuracy(5, 5), 100);
  });

  it("keeps accuracy finite and within 0 to 100 for invalid counts", () => {
    assert.equal(accuracy(5, 0), 0);
    assert.equal(accuracy(1, -1), 0);
    assert.equal(accuracy(-1, 2), 0);
    assert.equal(accuracy(3, 2), 100);
    assert.equal(accuracy(NaN, 2), 0);
    assert.equal(accuracy(1, Infinity), 0);
    assert.equal(accuracy(Infinity, 2), 0);
  });

  it("returns the rounded median rather than the mean", () => {
    assert.equal(summarize([]), 0);
    assert.equal(summarize([125.5]), 126);
    assert.equal(summarize([1000, 101, 100]), 101);
    assert.equal(summarize([400, 100, 201, 200]), 201);
    assert.equal(summarize([0, 0, 2]), 0);
    assert.equal(summarize([10, 2, 3]), 3);
  });

  it("does not mutate reaction samples and ignores invalid durations", () => {
    const samples = [300, 100, 200];
    assert.equal(summarize(samples), 200);
    assert.deepEqual(samples, [300, 100, 200]);
    assert.equal(summarize([NaN, Infinity, -1, 100, 200]), 150);
    assert.equal(summarize([NaN, Infinity, -1]), 0);
    assert.equal(
      summarize([Number.MAX_VALUE, Number.MAX_VALUE]),
      Number.MAX_VALUE,
    );
  });
});
