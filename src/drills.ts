import { keyFromEvent, type Action } from "./trainer";

type KeyStep = { kind: "key"; actionId: string; cue: string };
type TargetStep = {
  kind: "target";
  target: "trooper" | "secure" | "deny";
  cue: string;
  holdActionId?: string;
};
export type DrillStep = KeyStep | TargetStep;
export type Scenario = {
  id: string;
  title: string;
  lesson: string;
  steps: readonly DrillStep[];
};

// These are input rehearsals, not tactical prescriptions or frame-accurate simulations.
export const SCENARIOS: readonly Scenario[] = [
  {
    id: "secure",
    title: "Last hit, then secure",
    lesson: "After a ranged last hit, move your aim to the rising soul.",
    steps: [
      {
        kind: "target",
        target: "trooper",
        cue: "The trooper is low. Land the ranged last hit.",
      },
      {
        kind: "target",
        target: "secure",
        cue: "Your last hit released a soul. Shoot it to secure it.",
      },
    ],
  },
  {
    id: "deny",
    title: "Contest the enemy soul",
    lesson:
      "An enemy ranged last hit gives you a chance to deny the released soul.",
    steps: [
      {
        kind: "target",
        target: "deny",
        cue: "An enemy finished a trooper. Shoot the released soul to deny it.",
      },
      {
        kind: "key",
        actionId: "MoveBackwards",
        cue: "You contested the soul. Back toward the marked cover.",
      },
    ],
  },
  {
    id: "parry",
    title: "Read the heavy melee",
    lesson:
      "Recognize the heavy-melee cue and find parry without looking down.",
    steps: [
      {
        kind: "key",
        actionId: "HeldItem",
        cue: "You are not carrying the urn. An opponent commits to heavy melee; press parry.",
      },
      {
        kind: "key",
        actionId: "MoveBackwards",
        cue: "The cue is over. Create space toward cover behind you.",
      },
    ],
  },
  {
    id: "dash-jump",
    title: "Dash into a jump",
    lesson:
      "Rehearse dash, then jump. Learn the actual movement timing in the sandbox.",
    steps: [
      {
        kind: "key",
        actionId: "Roll",
        cue: "You need to reposition. Start with a dash.",
      },
      {
        kind: "key",
        actionId: "Mantle",
        cue: "Follow your dash with a jump. This drill checks order, not game timing.",
      },
    ],
  },
  {
    id: "reload",
    title: "Cover, then reload",
    lesson:
      "Rehearse a safe reload after moving toward cover, not in the open.",
    steps: [
      {
        kind: "key",
        actionId: "MoveLeft",
        cue: "Your magazine is low. Cover is on your left; strafe toward it.",
      },
      {
        kind: "key",
        actionId: "Reload",
        cue: "You reached the cover cue. Reload your weapon.",
      },
    ],
  },
  {
    id: "strafe",
    title: "Move and contest",
    lesson:
      "Keep a movement key held while acquiring a target with your mouse.",
    steps: [
      {
        kind: "key",
        actionId: "MoveRight",
        cue: "Begin strafing right. Keep this movement key held for the next step.",
      },
      {
        kind: "target",
        target: "deny",
        holdActionId: "MoveRight",
        cue: "Keep strafing right while you shoot the enemy's released soul.",
      },
    ],
  },
];

export function chooseScenario(
  id: string,
  previousId?: string,
  random = Math.random,
): Scenario {
  const selected = SCENARIOS.find((scenario) => scenario.id === id);
  if (selected) return selected;
  const candidates = SCENARIOS.filter((scenario) => scenario.id !== previousId);
  const index = Math.max(
    0,
    Math.min(candidates.length - 1, Math.floor(random() * candidates.length)),
  );
  return candidates[Number.isFinite(index) ? index : 0]!;
}

export type Target = {
  x: number;
  y: number;
  radius: number;
  kind: TargetStep["target"];
};
type Bounds = { width: number; height: number };

export function targetPosition(
  target: Target,
  elapsedMs: number,
  bounds: Bounds,
) {
  const seconds = Math.max(0, elapsedMs) / 1000;
  const moving = target.kind !== "trooper";
  return {
    x: Math.max(
      target.radius,
      Math.min(
        bounds.width - target.radius,
        target.x + (moving ? Math.sin(seconds * 2) * 15 : 0),
      ),
    ),
    y: Math.max(
      155 + target.radius,
      Math.min(
        bounds.height - target.radius - 30,
        target.y - (moving ? seconds * 32 : 0),
      ),
    ),
  };
}

export function targetContains(
  target: Target,
  elapsedMs: number,
  bounds: Bounds,
  x: number,
  y: number,
): boolean {
  const position = targetPosition(target, elapsedMs, bounds);
  return Math.hypot(x - position.x, y - position.y) <= target.radius;
}

export function bindingIsHeld(
  binding: string,
  heldKeys: ReadonlySet<string>,
): boolean {
  return binding.split("+").every((key) => heldKeys.has(key));
}

export function matchesAction(
  event: KeyboardEvent,
  action: Action,
  allowHeldModifiers = false,
): boolean {
  const actual = keyFromEvent(event);
  if (actual === action.key) return true;
  if (!allowHeldModifiers || event.metaKey) return false;
  const key = physicalKey(event);
  const expected = action.key.split("+");
  const pressed = new Set(actual.split("+"));
  return expected.at(-1) === key && expected.every((key) => pressed.has(key));
}

export function physicalKey(
  event: Pick<KeyboardEvent, "code" | "key">,
): string {
  return keyFromEvent({
    code: event.code,
    key: event.key,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
  });
}
