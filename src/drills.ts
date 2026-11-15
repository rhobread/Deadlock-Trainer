import { keyFromEvent, type Action } from "./trainer";
import type { InputGoal } from "./input";

type KeyStep = { kind: "key"; actionId: string; cue: string };
type TargetStep = {
  kind: "target";
  target: "trooper" | "secure" | "deny";
  cue: string;
  holdActionId?: string;
  heldActions?: readonly string[];
};
type InputStep = {
  kind: "input";
  label: string;
  cue: string;
  goal: InputGoal;
  readyAfterMs?: number;
  timedJump?: boolean;
  releasedActions?: readonly string[];
};
export type DrillStep = KeyStep | TargetStep | InputStep;
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
        kind: "input",
        label: "Directional dash",
        goal: { actions: ["Roll"], with: ["MoveForward"], behavior: "press" },
        cue: "Hold forward and press dash. Keep forward held for the jump.",
      },
      {
        kind: "input",
        label: "Jump on the blue cue",
        goal: { actions: ["Mantle"], with: ["MoveForward"], behavior: "press" },
        readyAfterMs: 300,
        timedJump: true,
        cue: "Keep forward held. Press jump when the cue turns blue; dash may remain held.",
      },
    ],
  },
  {
    id: "light-melee",
    title: "Light melee: tap, not hold",
    lesson: "Distinguish a short melee press from a heavy-melee hold.",
    steps: [
      {
        kind: "input",
        label: "Tap melee",
        cue: "Give melee a short tap. We check duration on release; this is not a release-to-attack mechanic.",
        goal: { actions: ["AbilityMelee"], behavior: "tap", tapMaxMs: 250 },
      },
      {
        kind: "input",
        label: "Strafe out",
        cue: "Hold left and back together to move out at an angle.",
        goal: {
          actions: ["MoveLeft", "MoveBackwards"],
          behavior: "hold",
          holdMs: 300,
        },
      },
    ],
  },
  {
    id: "heavy-melee",
    title: "Heavy melee: hold through windup",
    lesson:
      "Heavy melee commits while held. Release afterward to re-arm the next rep.",
    steps: [
      {
        kind: "input",
        label: "Hold heavy melee",
        cue: "Hold melee continuously through the charge cue. Do not tap or release to fire.",
        goal: { actions: ["AbilityMelee"], behavior: "hold", holdMs: 500 },
      },
      {
        kind: "input",
        label: "Release melee",
        cue: "The heavy has committed. Release melee so the next press is a fresh input.",
        goal: { actions: ["AbilityMelee"], behavior: "release" },
      },
      {
        kind: "key",
        actionId: "HeldItem",
        cue: "Your partner winds up a return melee. Press parry; no urn is carried.",
      },
    ],
  },
  {
    id: "moving-heavy",
    title: "Movement + heavy melee",
    lesson: "Keep directional inputs held while committing a heavy melee.",
    steps: [
      {
        kind: "input",
        label: "Move diagonally + charge",
        cue: "Hold forward, right, and melee at the same time through the charge cue.",
        goal: {
          actions: ["AbilityMelee"],
          with: ["MoveForward", "MoveRight"],
          behavior: "hold",
          holdMs: 500,
        },
      },
      {
        kind: "input",
        label: "Release melee, keep moving",
        cue: "Let melee go without releasing forward and right.",
        goal: {
          actions: ["AbilityMelee"],
          with: ["MoveForward", "MoveRight"],
          behavior: "release",
        },
      },
    ],
  },
  {
    id: "crouch-melee",
    title: "Crouch + heavy melee coordination",
    lesson:
      "Rehearse overlapping crouch and melee; this does not claim a special damage combo.",
    steps: [
      {
        kind: "input",
        label: "Crouch + hold melee",
        cue: "Keep crouch down while holding melee through its windup. Watch the live held-input HUD.",
        goal: {
          actions: ["AbilityMelee"],
          with: ["Crouch"],
          behavior: "hold",
          holdMs: 500,
        },
      },
      {
        kind: "input",
        label: "Release melee independently",
        cue: "Release only melee. Keep crouch held.",
        goal: {
          actions: ["AbilityMelee"],
          with: ["Crouch"],
          behavior: "release",
        },
      },
      {
        kind: "input",
        label: "Stand up",
        cue: "Now release crouch. Releasing one input must not release the other.",
        goal: { actions: ["Crouch"], behavior: "release" },
      },
    ],
  },
  {
    id: "dash-slide",
    title: "Dash → crouch → shoot → release",
    lesson:
      "Add crouch after the dash, keep it held while firing, then release to end the slide cue.",
    steps: [
      {
        kind: "input",
        label: "Forward + dash",
        cue: "Hold forward and press dash. Do not pre-hold crouch; add it on the next cue.",
        releasedActions: ["Crouch"],
        goal: { actions: ["Roll"], with: ["MoveForward"], behavior: "press" },
      },
      {
        kind: "input",
        label: "Add and hold crouch",
        cue: "Now add crouch while keeping forward held. The range uses approximate movement, not game slide physics.",
        goal: {
          actions: ["Crouch"],
          with: ["MoveForward"],
          behavior: "hold",
          holdMs: 300,
        },
      },
      {
        kind: "target",
        target: "deny",
        heldActions: ["MoveForward", "Crouch"],
        cue: "Keep forward and crouch held together while shooting the enemy soul.",
      },
      {
        kind: "input",
        label: "Release crouch only",
        cue: "Release crouch to cancel the slide cue. Keep forward held.",
        goal: {
          actions: ["Crouch"],
          with: ["MoveForward"],
          behavior: "release",
        },
      },
    ],
  },
  {
    id: "zoom-strafe",
    title: "Strafe + zoom + fire",
    lesson:
      "Practice three simultaneous inputs with a zoom-capable training weapon. Hero alt-fire behavior varies.",
    steps: [
      {
        kind: "input",
        label: "Strafe while zooming",
        cue: "Hold right movement and zoom together. This range models zoom, not every hero's alternate fire.",
        goal: { actions: ["MoveRight", "ADS"], behavior: "hold", holdMs: 250 },
      },
      {
        kind: "target",
        target: "trooper",
        heldActions: ["MoveRight", "ADS"],
        cue: "Keep movement and zoom held while firing at the low-health target.",
      },
      {
        kind: "input",
        label: "Release zoom, keep moving",
        cue: "Release zoom without letting go of right movement.",
        goal: { actions: ["ADS"], with: ["MoveRight"], behavior: "release" },
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
