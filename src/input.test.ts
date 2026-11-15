import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GoalEvaluator, InputState } from "./input.ts";
import type { InputGoal } from "./input.ts";

function event(
  code: string,
  overrides: Partial<Parameters<InputState["keyDown"]>[0]> = {},
): Parameters<InputState["keyDown"]>[0] {
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

const bindings: Record<string, string> = {
  melee: "Q",
  forward: "W",
  left: "A",
  crouch: "CTRL",
  dash: "SHIFT",
  jump: "SPACE",
  ads: "MOUSE2",
  fire: "MOUSE1",
};

function setup(goal: InputGoal, custom: Record<string, string> = {}) {
  const input = new InputState();
  const evaluator = new GoalEvaluator(
    (action) => custom[action] ?? bindings[action] ?? "",
  );
  evaluator.begin(goal, 0, input);
  return {
    input,
    evaluator,
    down(code: string, now: number, repeat = false) {
      return evaluator.update(
        input,
        now,
        input.keyDown(event(code, { repeat }), now),
      );
    },
    up(code: string, now: number) {
      return evaluator.update(input, now, input.keyUp(event(code), now));
    },
    mouseDown(button: number, now: number) {
      return evaluator.update(input, now, input.pointerDown(button, now));
    },
    mouseUp(button: number, now: number) {
      return evaluator.update(input, now, input.pointerUp(button, now));
    },
    poll(now: number) {
      return evaluator.update(input, now);
    },
  };
}

describe("InputState", () => {
  it("reads inherited DOM event properties instead of relying on object spread", () => {
    const input = new InputState();
    const nativeShaped = Object.create(
      event("KeyQ", { key: "q" }),
    ) as Parameters<InputState["keyDown"]>[0];
    assert.equal(input.keyDown(nativeShaped, 0).key, "Q");
    assert.equal(input.held("Q"), true);
    input.keyUp(nativeShaped, 10);
    assert.equal(input.held("Q"), false);
  });
  it("normalizes physical keys without synthesizing held modifiers", () => {
    const input = new InputState();
    assert.equal(
      input.keyDown(
        event("KeyQ", { key: "a", ctrlKey: true, shiftKey: true }),
        10,
      ).key,
      "Q",
    );
    assert.deepEqual([...input.keys], ["Q"]);
    assert.equal(input.held("CTRL+Q"), false);
    assert.equal(input.keyDown(event("ControlLeft"), 20).key, "CTRL");
    assert.equal(input.held("CTRL+Q"), true);
    assert.equal(input.since("CTRL+Q"), 20);
  });

  it("requires simultaneous components rather than sequential presses", () => {
    const input = new InputState();
    input.keyDown(event("ControlLeft"), 0);
    input.keyUp(event("ControlLeft"), 10);
    input.keyDown(event("KeyQ"), 20);
    assert.equal(input.held("CTRL+Q"), false);
    assert.equal(input.since("CTRL+Q"), null);
    input.keyDown(event("ControlLeft"), 30);
    assert.equal(input.since("CTRL+Q"), 30);
    assert.equal(input.held(" ctrl + q "), true);
    assert.equal(input.held("CTRL++Q"), false);
  });

  it("keeps two-sided modifiers held until their last physical source releases", () => {
    const input = new InputState();
    input.keyDown(event("ShiftLeft"), 10);
    const second = input.keyDown(event("ShiftRight"), 20);
    assert.equal(second.repeat, false);
    assert.equal(second.changed, false);
    assert.equal(input.since("SHIFT"), 10);
    assert.equal(
      input.keyUp(event("ShiftLeft", { repeat: true }), 30).repeat,
      false,
    );
    assert.equal(input.held("SHIFT"), true);
    assert.equal(input.since("SHIFT"), 10);
    assert.equal(input.keyUp(event("ShiftRight"), 40).changed, true);
    assert.equal(input.since("SHIFT"), null);
  });

  it("does not reset held time on explicit or implicit repeats", () => {
    const input = new InputState();
    input.keyDown(event("KeyQ"), 5);
    assert.equal(
      input.keyDown(event("KeyQ", { repeat: true }), 50).repeat,
      true,
    );
    assert.equal(input.keyDown(event("KeyQ"), 100).repeat, true);
    assert.equal(input.since("Q"), 5);
    input.keyUp(event("KeyQ"), 120);
    input.keyDown(event("KeyQ"), 200);
    assert.equal(input.since("Q"), 200);
  });

  it("maps every mouse button and supports literal mouse chords", () => {
    const input = new InputState();
    for (const [button, key] of [
      [0, "MOUSE1"],
      [2, "MOUSE2"],
      [1, "MOUSE3"],
      [3, "MOUSE4"],
      [4, "MOUSE5"],
    ] as const) {
      assert.equal(input.pointerDown(button, button + 10).key, key);
      assert.equal(input.held(key), true);
    }
    input.keyDown(event("ControlLeft"), 50);
    assert.equal(input.since("CTRL+MOUSE2"), 50);
    assert.equal(input.held("MOUSE1+MOUSE2"), true);
    assert.equal(input.pointerDown(2, 100).repeat, true);
    assert.equal(input.since("MOUSE2"), 12);
    assert.equal(input.pointerUp(2, 110).repeat, false);
    assert.equal(input.held("MOUSE1+MOUSE2"), false);
  });

  it("ignores unsupported keys/buttons and clears every source and timestamp", () => {
    const input = new InputState();
    assert.equal(
      input.keyDown(event("Unidentified", { key: "Unidentified" }), 0).key,
      "",
    );
    assert.equal(input.keyUp(event("Unidentified"), 1).key, "");
    for (const button of [-1, 5, 99, 0.5, NaN]) {
      assert.equal(input.pointerDown(button, 0).key, "");
      assert.equal(input.pointerUp(button, 1).key, "");
    }
    assert.equal(input.keys.size, 0);
    assert.equal(input.held(""), false);
    input.keyDown(event("ShiftLeft"), 10);
    input.keyDown(event("ShiftRight"), 20);
    input.pointerDown(0, 30);
    input.clear();
    assert.equal(input.keys.size, 0);
    assert.equal(input.since("SHIFT"), null);
    assert.equal(input.keyDown(event("ShiftLeft"), 40).repeat, false);
    assert.equal(input.since("SHIFT"), 40);
  });

  it("falls back to key when code is unavailable", () => {
    const input = new InputState();
    input.keyDown(event("", { key: "q" }), 10);
    assert.equal(input.held("Q"), true);
    input.keyUp(event("", { key: "q" }), 20);
    assert.equal(input.held("Q"), false);
  });
});

describe("GoalEvaluator press and chords", () => {
  it("requires a fresh primary down and emits completion only once", () => {
    const goal: InputGoal = { actions: ["melee"], behavior: "press" };
    const s = setup(goal);
    s.input.keyDown(event("KeyQ"), 1);
    s.evaluator.begin(goal, 2, s.input);
    assert.equal(s.poll(3).complete, false);
    assert.equal(s.down("KeyQ", 4, true).complete, false);
    s.up("KeyQ", 5);
    assert.equal(s.down("KeyQ", 6).complete, true);
    assert.deepEqual(s.poll(7), {
      complete: false,
      failed: false,
      progress: 1,
      note: "Complete.",
    });
    s.up("KeyQ", 8);
    assert.equal(s.down("KeyQ", 9).complete, false);
  });

  it("assembles held movement/crouch prerequisites without misses", () => {
    const s = setup({
      actions: ["jump"],
      with: ["forward", "crouch"],
      behavior: "press",
    });
    assert.equal(s.down("KeyW", 10).failed, false);
    assert.equal(s.down("ControlLeft", 20).failed, false);
    assert.equal(s.down("ShiftLeft", 30).failed, false);
    assert.equal(s.down("Space", 40).complete, true);
  });

  it("reports missing movement once per primary attempt", () => {
    const s = setup({
      actions: ["jump"],
      with: ["forward"],
      behavior: "press",
    });
    const miss = s.down("Space", 10);
    assert.equal(miss.failed, true);
    assert.match(miss.note, /W.*held/);
    assert.equal(s.poll(20).failed, false);
    assert.equal(s.down("Space", 30, true).failed, false);
    assert.equal(s.down("KeyW", 40).complete, false);
    s.up("Space", 50);
    assert.equal(s.down("Space", 60).complete, true);
  });

  it("handles custom CTRL+Q bindings without treating CTRL as the action", () => {
    const s = setup(
      { actions: ["melee"], behavior: "press" },
      { melee: "CTRL+Q" },
    );
    assert.equal(s.down("ControlLeft", 10).complete, false);
    assert.equal(s.down("ShiftLeft", 20).failed, false);
    assert.equal(s.down("KeyQ", 30).complete, true);
    const missing = setup(
      { actions: ["melee"], behavior: "press" },
      { melee: "CTRL+Q" },
    );
    assert.match(missing.down("KeyQ", 0).note, /CTRL.*held/);
    assert.equal(missing.down("ControlLeft", 1).complete, false);
    missing.up("KeyQ", 2);
    assert.equal(missing.down("KeyQ", 3).complete, true);
  });

  it("allows assembling multiple primary actions and ignores unrelated inputs", () => {
    const s = setup({ actions: ["forward", "crouch"], behavior: "press" });
    assert.equal(s.down("KeyW", 10).failed, false);
    assert.equal(s.down("ControlLeft", 20).complete, true);
    const wrong = setup({ actions: ["melee"], behavior: "press" });
    assert.equal(wrong.down("KeyR", 10).failed, false);
    assert.equal(wrong.poll(20).failed, false);
    assert.equal(wrong.down("KeyR", 30, true).failed, false);
    assert.equal(wrong.down("KeyQ", 40).complete, true);
  });

  it("does not treat the second Shift source as a fresh press", () => {
    const s = setup({ actions: ["dash"], behavior: "press" });
    s.input.keyDown(event("ShiftLeft"), 0);
    assert.equal(s.down("ShiftRight", 10).complete, false);
    s.up("ShiftLeft", 20);
    assert.equal(s.input.held("SHIFT"), true);
    assert.equal(s.poll(30).complete, false);
    s.up("ShiftRight", 40);
    assert.equal(s.down("ShiftRight", 50).complete, true);
  });

  it("requires ADS held at the fire edge, not ADS tapped earlier", () => {
    const s = setup({ actions: ["fire"], with: ["ads"], behavior: "press" });
    assert.equal(s.mouseDown(2, 10).failed, false);
    s.mouseUp(2, 20);
    assert.match(s.mouseDown(0, 30).note, /MOUSE2.*held/);
    assert.equal(s.mouseDown(2, 40).complete, false);
    s.mouseUp(0, 50);
    assert.equal(s.mouseDown(0, 60).complete, true);
  });

  it("supports custom modifier and mouse primary bindings", () => {
    const s = setup(
      { actions: ["fire"], with: ["ads"], behavior: "press" },
      { fire: "CTRL+MOUSE1" },
    );
    assert.equal(s.down("ControlLeft", 0).failed, false);
    assert.equal(s.mouseDown(2, 10).failed, false);
    assert.equal(s.mouseDown(0, 20).complete, true);
  });
});

describe("GoalEvaluator holds", () => {
  it("automatically completes a continuous heavy hold at its threshold", () => {
    const s = setup({ actions: ["melee"], behavior: "hold", holdMs: 500 });
    assert.equal(s.down("KeyQ", 100).progress, 0);
    assert.equal(s.poll(350).progress, 0.5);
    assert.equal(s.poll(599).complete, false);
    assert.equal(s.poll(600).complete, true);
    assert.equal(s.input.held("Q"), true);
    assert.equal(s.poll(700).complete, false);
  });

  it("fails once on early release and resets the next hold's credit", () => {
    const s = setup({ actions: ["melee"], behavior: "hold", holdMs: 500 });
    s.down("KeyQ", 0);
    assert.equal(s.poll(200).progress, 0.4);
    const miss = s.up("KeyQ", 250);
    assert.equal(miss.failed, true);
    assert.equal(miss.progress, 0);
    assert.equal(s.poll(300).failed, false);
    assert.equal(s.poll(1000).failed, false);
    s.down("KeyQ", 1100);
    assert.equal(s.poll(1599).complete, false);
    assert.equal(s.poll(1600).complete, true);
  });

  it("credits a threshold reached before release even without a frame update", () => {
    const s = setup({ actions: ["melee"], behavior: "hold", holdMs: 500 });
    s.down("KeyQ", 100);
    assert.equal(s.up("KeyQ", 600).complete, true);
    const chord = setup({
      actions: ["melee"],
      with: ["forward"],
      behavior: "hold",
      holdMs: 500,
    });
    chord.down("KeyW", 0);
    chord.down("KeyQ", 100);
    assert.equal(chord.up("KeyW", 601).complete, true);
  });

  it("preserves a continuous logical hold when one of two Shift keys releases", () => {
    const s = setup({ actions: ["dash"], behavior: "hold", holdMs: 500 });
    s.down("ShiftLeft", 0);
    s.down("ShiftRight", 100);
    assert.equal(s.up("ShiftLeft", 200).failed, false);
    assert.equal(s.poll(500).complete, true);
  });

  it("does not reset a hold for unrelated overlapping controls", () => {
    const s = setup({ actions: ["melee"], behavior: "hold", holdMs: 500 });
    s.down("KeyQ", 0);
    assert.equal(s.down("KeyW", 100).failed, false);
    assert.equal(s.mouseDown(2, 200).failed, false);
    assert.equal(s.down("ShiftLeft", 300).failed, false);
    assert.equal(s.poll(500).complete, true);
  });

  it("fails when required movement or crouch stops, without frame penalties", () => {
    const s = setup({
      actions: ["melee"],
      with: ["forward", "crouch"],
      behavior: "hold",
      holdMs: 400,
    });
    s.down("KeyW", 0);
    s.down("ControlLeft", 10);
    s.down("KeyQ", 20);
    assert.equal(s.up("KeyW", 100).failed, true);
    assert.equal(s.poll(500).failed, false);
    assert.equal(s.down("KeyW", 600).complete, false);
    assert.equal(s.poll(1000).complete, false);
    s.up("KeyQ", 1100);
    s.down("KeyQ", 1200);
    assert.equal(s.poll(1600).complete, true);
  });

  it("ignores repeats for starting, but preserves an already-started hold", () => {
    const s = setup({ actions: ["melee"], behavior: "hold", holdMs: 100 });
    assert.equal(s.down("KeyQ", 0, true).complete, false);
    assert.equal(s.poll(1000).complete, false);
    s.up("KeyQ", 1100);
    s.down("KeyQ", 1200);
    assert.equal(s.down("KeyQ", 1250, true).progress, 0.5);
    assert.equal(s.poll(1300).complete, true);
  });

  it("starts carried holds at begin and discards partial credit on rebegin", () => {
    const goal: InputGoal = {
      actions: ["melee"],
      behavior: "hold",
      holdMs: 500,
    };
    const s = setup(goal);
    s.down("KeyQ", 0);
    assert.equal(s.poll(400).progress, 0.8);
    s.evaluator.begin(goal, 1000, s.input);
    assert.equal(s.poll(1000).progress, 0);
    assert.equal(s.poll(1499).complete, false);
    assert.equal(s.poll(1500).complete, true);
  });

  it("detects a broken/reassembled prerequisite between polls", () => {
    const s = setup({
      actions: ["melee"],
      with: ["forward"],
      behavior: "hold",
      holdMs: 500,
    });
    s.down("KeyW", 0);
    s.down("KeyQ", 10);
    s.input.keyUp(event("KeyW"), 100);
    s.input.keyDown(event("KeyW"), 200);
    assert.equal(s.poll(300).failed, true);
    assert.equal(s.poll(600).complete, false);
  });
});

describe("GoalEvaluator taps", () => {
  it("completes a light tap on release, not on down or a short held interval", () => {
    const s = setup({ actions: ["melee"], behavior: "tap" });
    assert.equal(s.down("KeyQ", 10).complete, false);
    assert.equal(s.poll(100).complete, false);
    assert.equal(s.up("KeyQ", 200).complete, true);
    assert.equal(s.poll(500).complete, false);
  });

  it("allows release exactly at the default 250 ms maximum", () => {
    const s = setup({ actions: ["melee"], behavior: "tap" });
    s.down("KeyQ", 100);
    assert.equal(s.up("KeyQ", 350).complete, true);
  });

  it("fails a long tap on polling once, requiring release before retry", () => {
    const s = setup({ actions: ["melee"], behavior: "tap", tapMaxMs: 150 });
    s.down("KeyQ", 0);
    assert.equal(s.poll(151).failed, true);
    assert.equal(s.poll(200).failed, false);
    assert.equal(s.down("KeyQ", 250, true).failed, false);
    assert.equal(s.up("KeyQ", 300).failed, false);
    s.down("KeyQ", 400);
    assert.equal(s.up("KeyQ", 500).complete, true);
  });

  it("fails a long tap on release if no threshold frame was polled", () => {
    const s = setup({ actions: ["melee"], behavior: "tap" });
    s.down("KeyQ", 0);
    assert.equal(s.up("KeyQ", 300).failed, true);
    assert.equal(s.poll(400).failed, false);
    s.down("KeyQ", 500);
    assert.equal(s.up("KeyQ", 600).complete, true);
  });

  it("requires ADS continuously throughout a mouse tap", () => {
    const s = setup({ actions: ["fire"], with: ["ads"], behavior: "tap" });
    s.mouseDown(2, 0);
    s.mouseDown(0, 10);
    assert.equal(s.mouseUp(2, 20).failed, true);
    assert.equal(s.mouseDown(2, 30).complete, false);
    assert.equal(s.mouseUp(0, 40).failed, false);
    s.mouseDown(0, 50);
    assert.equal(s.mouseUp(0, 100).complete, true);
  });

  it("does not mistake a carried heavy hold's release for a fresh light tap", () => {
    const s = setup({ actions: ["melee"], behavior: "hold", holdMs: 100 });
    s.down("KeyQ", 0);
    assert.equal(s.poll(100).complete, true);
    s.evaluator.begin({ actions: ["melee"], behavior: "tap" }, 100, s.input);
    assert.equal(s.up("KeyQ", 110).complete, false);
    s.down("KeyQ", 200);
    assert.equal(s.up("KeyQ", 250).complete, true);
  });

  it("rejects a primary released and pressed again between polls", () => {
    const s = setup({ actions: ["melee"], behavior: "tap" });
    s.down("KeyQ", 0);
    s.input.keyUp(event("KeyQ"), 50);
    s.input.keyDown(event("KeyQ"), 100);
    assert.equal(s.poll(150).failed, true);
    assert.equal(s.up("KeyQ", 200).complete, false);
  });
});

describe("GoalEvaluator releases and resets", () => {
  it("requires arming from a held primary before a release can complete", () => {
    const s = setup({
      actions: ["crouch"],
      with: ["forward"],
      behavior: "release",
    });
    assert.equal(s.poll(0).complete, false);
    assert.equal(s.up("ControlLeft", 10).complete, false);
    assert.equal(s.down("KeyW", 20).failed, false);
    assert.equal(s.down("ControlLeft", 30).complete, false);
    assert.equal(s.up("ControlLeft", 40).complete, true);
  });

  it("arms at begin from a previous step while retaining held movement", () => {
    const s = setup({
      actions: ["crouch"],
      with: ["forward"],
      behavior: "press",
    });
    s.down("KeyW", 0);
    assert.equal(s.down("ControlLeft", 10).complete, true);
    s.evaluator.begin(
      { actions: ["crouch"], with: ["forward"], behavior: "release" },
      20,
      s.input,
    );
    assert.equal(s.up("ControlLeft", 30).complete, true);
    assert.equal(s.input.held("W"), true);
    assert.equal(s.poll(40).complete, false);
  });

  it("requires prerequisites during release and reports a missing one only once", () => {
    const s = setup({
      actions: ["crouch"],
      with: ["forward"],
      behavior: "release",
    });
    assert.match(s.down("ControlLeft", 0).note, /W.*held/);
    assert.equal(s.poll(10).failed, false);
    s.down("KeyW", 20);
    assert.equal(s.up("ControlLeft", 30).complete, false);
    s.down("ControlLeft", 40);
    assert.equal(s.up("KeyW", 50).failed, true);
    assert.equal(s.up("ControlLeft", 60).complete, false);
    s.down("KeyW", 70);
    s.down("ControlLeft", 80);
    assert.equal(s.up("ControlLeft", 90).complete, true);
  });

  it("does not release a logical Shift action until both sides are up", () => {
    const s = setup({ actions: ["dash"], behavior: "release" });
    s.down("ShiftLeft", 0);
    s.down("ShiftRight", 10);
    assert.equal(s.up("ShiftLeft", 20).complete, false);
    assert.equal(s.up("ShiftRight", 30).complete, true);
  });

  it("detects a release prerequisite dropped and reassembled between polls", () => {
    const s = setup({
      actions: ["crouch"],
      with: ["forward"],
      behavior: "release",
    });
    s.down("KeyW", 0);
    s.down("ControlLeft", 10);
    s.input.keyUp(event("KeyW"), 20);
    s.input.keyDown(event("KeyW"), 30);
    assert.equal(s.poll(40).failed, true);
    assert.equal(s.up("ControlLeft", 50).complete, false);
  });

  it("keeps the modifier held while releasing a custom CTRL+Q action", () => {
    const s = setup(
      { actions: ["melee"], behavior: "release" },
      { melee: "CTRL+Q" },
    );
    s.down("ControlLeft", 0);
    s.down("KeyQ", 10);
    assert.equal(s.up("KeyQ", 20).complete, true);
    const broken = setup(
      { actions: ["melee"], behavior: "release" },
      { melee: "CTRL+Q" },
    );
    broken.down("ControlLeft", 0);
    broken.down("KeyQ", 10);
    assert.equal(broken.up("ControlLeft", 20).failed, true);
    assert.equal(broken.up("KeyQ", 30).complete, false);
  });

  it("waits until all primary actions have been released", () => {
    const s = setup({
      actions: ["crouch", "melee"],
      with: ["forward"],
      behavior: "release",
    });
    s.down("KeyW", 0);
    s.down("ControlLeft", 10);
    s.down("KeyQ", 20);
    assert.equal(s.up("KeyQ", 30).complete, false);
    assert.equal(s.up("ControlLeft", 40).complete, true);
  });

  it("discards partial holds after pause-style clear and ignores continued repeats", () => {
    const goal: InputGoal = {
      actions: ["melee"],
      behavior: "hold",
      holdMs: 500,
    };
    const s = setup(goal);
    s.down("KeyQ", 0);
    s.poll(400);
    s.input.clear();
    s.evaluator.begin(goal, 1000, s.input);
    assert.equal(s.poll(2000).complete, false);
    s.down("KeyQ", 2100, true);
    assert.equal(s.poll(3000).complete, false);
    s.up("KeyQ", 3100);
    s.down("KeyQ", 3200);
    assert.equal(s.poll(3699).complete, false);
    assert.equal(s.poll(3700).complete, true);
  });

  it("clears old release arming and completion latches at begin", () => {
    const goal: InputGoal = { actions: ["crouch"], behavior: "release" };
    const s = setup(goal);
    s.down("ControlLeft", 0);
    s.input.clear();
    s.evaluator.begin(goal, 100, s.input);
    assert.equal(s.up("ControlLeft", 200).complete, false);
    s.down("ControlLeft", 300);
    assert.equal(s.up("ControlLeft", 400).complete, true);
    s.evaluator.begin(goal, 500, s.input);
    assert.equal(s.poll(600).complete, false);
    s.down("ControlLeft", 700);
    assert.equal(s.up("ControlLeft", 800).complete, true);
  });

  it("does not complete empty or unresolved goals", () => {
    const s = setup({ actions: [], behavior: "release" });
    assert.equal(s.poll(0).complete, false);
    s.evaluator.begin(
      { actions: ["unknown"], behavior: "hold", holdMs: 0 },
      10,
      s.input,
    );
    assert.equal(s.poll(1000).complete, false);
  });
});
