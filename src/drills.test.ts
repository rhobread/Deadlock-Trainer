import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACTIONS } from "./trainer";
import {
  SCENARIOS,
  bindingIsHeld,
  chooseScenario,
  matchesAction,
  targetContains,
  targetPosition,
  type Target,
} from "./drills";

describe("game situation drills", () => {
  it("uses existing actions and never teaches a soul shot after a melee last hit", () => {
    const ids = new Set(ACTIONS.map((action) => action.id));
    for (const scenario of SCENARIOS) {
      assert.ok(scenario.steps.length >= 2);
      for (const step of scenario.steps) {
        if (step.kind === "key") assert.ok(ids.has(step.actionId));
        else if (step.kind === "input") {
          for (const id of [...step.goal.actions, ...(step.goal.with || [])])
            assert.ok(ids.has(id));
        } else {
          if (step.holdActionId) assert.ok(ids.has(step.holdActionId));
          for (const id of step.heldActions || []) assert.ok(ids.has(id));
        }
      }
    }
    const secure = chooseScenario("secure");
    assert.deepEqual(
      secure.steps.map((step) => (step.kind === "target" ? step.target : "")),
      ["trooper", "secure"],
    );
    assert.deepEqual(
      chooseScenario("dash-jump").steps.map((step) =>
        step.kind === "input" ? step.goal.actions[0] : "",
      ),
      ["Roll", "Mantle"],
    );
  });

  it("models heavy commitment while held and release only as re-arming", () => {
    const heavy = chooseScenario("heavy-melee");
    assert.equal(
      heavy.steps[0]?.kind === "input" && heavy.steps[0].goal.behavior,
      "hold",
    );
    assert.equal(
      heavy.steps[1]?.kind === "input" && heavy.steps[1].goal.behavior,
      "release",
    );
    const slide = chooseScenario("dash-slide");
    assert.equal(
      slide.steps[0]?.kind === "input" && slide.steps[0].releasedActions?.[0],
      "Crouch",
    );
    assert.deepEqual(
      slide.steps[2]?.kind === "target" && slide.steps[2].heldActions,
      ["MoveForward", "Crouch"],
    );
    assert.equal(
      slide.steps[3]?.kind === "input" && slide.steps[3].goal.behavior,
      "release",
    );
  });

  it("rotates situations without immediately repeating them", () => {
    assert.equal(chooseScenario("parry").id, "parry");
    assert.notEqual(chooseScenario("all", "secure", () => 0).id, "secure");
    assert.equal(
      chooseScenario("all", undefined, () => Number.NaN).id,
      SCENARIOS[0]!.id,
    );
  });
});

describe("moving target geometry", () => {
  const bounds = { width: 500, height: 400 };
  const target: Target = { x: 220, y: 300, radius: 20, kind: "secure" };

  it("moves souls upward, keeps them in bounds, and leaves troopers stationary", () => {
    assert.ok(targetPosition(target, 1000, bounds).y < target.y);
    assert.equal(
      targetPosition({ ...target, kind: "trooper" }, 1000, bounds).y,
      target.y,
    );
    const end = targetPosition(target, 30_000, bounds);
    assert.ok(end.y >= 155 + target.radius);
    assert.ok(end.x >= target.radius && end.x <= bounds.width - target.radius);
  });

  it("scores against the current position rather than the spawn location", () => {
    const position = targetPosition(target, 2000, bounds);
    assert.equal(
      targetContains(target, 2000, bounds, position.x, position.y),
      true,
    );
    assert.equal(
      targetContains(target, 2000, bounds, target.x, target.y),
      false,
    );
    assert.equal(
      targetContains(
        target,
        2000,
        bounds,
        position.x + target.radius + 1,
        position.y,
      ),
      false,
    );
  });
});

describe("simultaneous movement and key sequences", () => {
  it("requires every key in a held binding", () => {
    assert.equal(bindingIsHeld("D", new Set(["D"])), true);
    assert.equal(bindingIsHeld("CTRL+D", new Set(["D"])), false);
    assert.equal(bindingIsHeld("CTRL+D", new Set(["CTRL", "D"])), true);
  });

  it("allows dash-jump with Shift still held only in scenario practice", () => {
    const jump = ACTIONS.find((action) => action.id === "Mantle")!;
    const event = {
      code: "Space",
      key: " ",
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent;
    assert.equal(matchesAction(event, jump), false);
    assert.equal(matchesAction(event, jump, true), true);
    assert.equal(
      matchesAction(
        { ...event, code: "KeyQ", key: "Q" } as KeyboardEvent,
        jump,
        true,
      ),
      false,
    );
  });
});
