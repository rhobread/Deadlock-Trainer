import { keyFromEvent } from "./trainer.ts";

export type InputGoal = {
  actions: readonly string[];
  behavior: "press" | "hold" | "tap" | "release";
  with?: readonly string[];
  holdMs?: number;
  tapMaxMs?: number;
};

export type InputEdge = {
  kind: "down" | "up";
  key: string;
  repeat: boolean;
  // A second physical source for an already-held token is not a fresh action.
  changed?: boolean;
};

type KeyEvent = Pick<
  KeyboardEvent,
  "code" | "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
> & { repeat?: boolean };

function components(binding: string): string[] {
  const parts = binding
    .toUpperCase()
    .split("+")
    .map((part) => part.trim());
  return parts.every(Boolean) ? parts : [];
}

function physicalKey(event: KeyEvent): string {
  return keyFromEvent({
    code: event.code,
    key: event.key,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
  });
}

function mouseKey(button: number): string {
  return ["MOUSE1", "MOUSE3", "MOUSE2", "MOUSE4", "MOUSE5"][button] ?? "";
}

export class InputState {
  private sources = new Map<string, string>();
  private pressedAt = new Map<string, number>();
  private active = new Set<string>();

  keyDown(event: KeyEvent, now: number): InputEdge {
    const key = physicalKey(event);
    return this.down(
      `key:${event.code || key}`,
      key,
      now,
      event.repeat ?? false,
    );
  }

  keyUp(event: KeyEvent, _now: number): InputEdge {
    const key = physicalKey(event);
    return this.up(`key:${event.code || key}`, key);
  }

  pointerDown(button: number, now: number): InputEdge {
    return this.down(`mouse:${button}`, mouseKey(button), now, false);
  }

  pointerUp(button: number, _now: number): InputEdge {
    return this.up(`mouse:${button}`, mouseKey(button));
  }

  held(binding: string): boolean {
    return this.since(binding) !== null;
  }

  since(binding: string): number | null {
    const parts = components(binding);
    if (!parts.length || parts.some((key) => !this.active.has(key)))
      return null;
    return Math.max(...parts.map((key) => this.pressedAt.get(key)!));
  }

  get keys(): ReadonlySet<string> {
    return this.active;
  }

  clear(): void {
    this.sources.clear();
    this.pressedAt.clear();
    this.active.clear();
  }

  private down(
    source: string,
    key: string,
    now: number,
    repeat: boolean,
  ): InputEdge {
    if (!key) return { kind: "down", key, repeat, changed: false };
    const alreadyDown = this.sources.has(source);
    const changed = !this.active.has(key);
    if (!alreadyDown) {
      this.sources.set(source, key);
      if (changed) {
        this.active.add(key);
        this.pressedAt.set(key, now);
      }
    }
    return { kind: "down", key, repeat: repeat || alreadyDown, changed };
  }

  private up(source: string, key: string): InputEdge {
    const pressed = this.sources.get(source);
    this.sources.delete(source);
    const changed =
      pressed !== undefined && ![...this.sources.values()].includes(pressed);
    if (changed) {
      this.active.delete(pressed!);
      this.pressedAt.delete(pressed!);
    }
    return { kind: "up", key: pressed ?? key, repeat: false, changed };
  }
}

type GoalResult = {
  complete: boolean;
  failed: boolean;
  progress: number;
  note: string;
};

export class GoalEvaluator {
  private goal: InputGoal | null = null;
  private bindings: string[] = [];
  private primaryKeys: string[] = [];
  private required: string[] = [];
  private startedAt: number | null = null;
  private armed = false;
  private blocked = false;
  private completed = false;

  constructor(private resolveBinding: (actionId: string) => string) {}

  begin(goal: InputGoal, now: number, input: InputState): void {
    this.goal = goal;
    this.bindings = goal.actions.map(this.resolveBinding);
    this.primaryKeys = [
      ...new Set(
        this.bindings.flatMap((binding) => components(binding).slice(-1)),
      ),
    ];
    this.required = [
      ...new Set([
        ...(goal.with ?? []).map(this.resolveBinding),
        ...this.bindings.flatMap((binding) => components(binding).slice(0, -1)),
      ]),
    ];
    this.startedAt = null;
    this.armed = false;
    this.blocked = false;
    this.completed = false;
    const held =
      this.bindings.length > 0 &&
      this.bindings.every((binding) => input.held(binding));
    if (goal.behavior === "release" && held) {
      this.armed = true;
      this.startedAt = now;
    }
    if (
      goal.behavior === "hold" &&
      held &&
      this.required.every((binding) => input.held(binding))
    ) {
      // A carried hold starts a new interval, never credit from the previous step.
      this.startedAt = now;
    }
    if (goal.behavior === "tap") {
      this.blocked = this.primaryKeys.some((key) => input.held(key));
    }
  }

  update(input: InputState, now: number, edge?: InputEdge): GoalResult {
    const idle = (note: string, progress = 0): GoalResult => ({
      complete: false,
      failed: false,
      progress,
      note,
    });
    if (!this.goal) return idle("No input goal.");
    if (this.completed) return idle("Complete.", 1);
    if (
      !this.bindings.length ||
      this.bindings.some((binding) => !components(binding).length)
    ) {
      return idle("A primary action needs a binding.");
    }

    const anyPrimary = this.primaryKeys.some((key) => input.held(key));
    const allPrimary = this.bindings.every((binding) => input.held(binding));
    const missing = this.required.filter((binding) => !input.held(binding));
    const freshDown =
      edge?.kind === "down" &&
      !!edge.key &&
      !edge.repeat &&
      edge.changed !== false;
    const primaryDown = freshDown && this.primaryKeys.includes(edge.key);
    if (this.blocked) {
      if (!anyPrimary) this.blocked = false;
      return idle(`Release ${this.primaryKeys.join(" + ")} before retrying.`);
    }

    if (this.armed || this.startedAt !== null) {
      const elapsed = Math.max(0, now - this.startedAt!);
      const holdDuration = Math.max(0, this.goal.holdMs ?? 500);
      const heldBeforeRelease = (binding: string) =>
        components(binding).every(
          (key) =>
            input.held(key) ||
            (edge?.kind === "up" && edge.changed === true && edge.key === key),
        );
      const interrupted = [...this.bindings, ...this.required].some(
        (binding) => (input.since(binding) ?? -Infinity) > this.startedAt!,
      );
      // The release event can arrive after the threshold without a frame in between.
      if (
        this.goal.behavior === "hold" &&
        elapsed >= holdDuration &&
        !interrupted &&
        [...this.bindings, ...this.required].every(heldBeforeRelease)
      ) {
        return this.finish();
      }
      if (missing.length) {
        return this.fail(
          `Keep ${missing.join(" + ")} held during the action.`,
          input,
        );
      }
      // Detect a broken prerequisite even when only the resulting state is polled.
      if (
        this.required.some((binding) => input.since(binding)! > this.startedAt!)
      ) {
        return this.fail("Keep the required inputs held continuously.", input);
      }
      if (this.goal.behavior === "release") {
        if (!anyPrimary) return this.finish();
        return idle(`Release ${this.primaryKeys.join(" + ")}.`);
      }

      if (this.goal.behavior === "hold") {
        if (
          !allPrimary ||
          this.bindings.some(
            (binding) => input.since(binding)! > this.startedAt!,
          )
        ) {
          return this.fail(
            "Released too soon. Hold the action continuously.",
            input,
          );
        }
        return idle(
          `Keep holding ${this.bindings.join(" + ")}.`,
          elapsed / holdDuration,
        );
      }

      const duration = Math.max(0, this.goal.tapMaxMs ?? 250);
      if (elapsed > duration) {
        return this.fail(
          "Held too long. Release, then try a quick tap.",
          input,
        );
      }
      if (interrupted)
        return this.fail("Keep the action held until its tap release.", input);
      if (!anyPrimary) return this.finish();
      return idle(
        `Release ${this.primaryKeys.join(" + ")} for a quick tap.`,
        duration ? elapsed / duration : 0,
      );
    }

    if (this.goal.behavior === "release" && allPrimary) {
      this.armed = true;
      this.startedAt = now;
      if (missing.length) {
        return this.fail(
          `Keep ${missing.join(" + ")} held during the action.`,
          input,
        );
      }
      return idle(`Release ${this.primaryKeys.join(" + ")}.`);
    }

    // Modifier/prerequisite downs and partial multi-action chords are assembly, not misses.
    if (primaryDown && this.primaryKeys.every((key) => input.held(key))) {
      if (missing.length) {
        return this.fail(
          `Keep ${missing.join(" + ")} held during the action.`,
          input,
        );
      }
      if (allPrimary) {
        if (this.goal.behavior === "press") return this.finish();
        this.startedAt = now;
        return this.update(input, now);
      }
    }
    const prerequisites = this.required.length
      ? ` with ${this.required.join(" + ")} held`
      : "";
    return idle(`Prepare ${this.bindings.join(" + ")}${prerequisites}.`);
  }

  private finish(): GoalResult {
    this.completed = true;
    this.startedAt = null;
    this.armed = false;
    return { complete: true, failed: false, progress: 1, note: "Complete." };
  }

  private fail(note: string, input: InputState): GoalResult {
    this.startedAt = null;
    this.armed = false;
    this.blocked = this.primaryKeys.some((key) => input.held(key));
    return { complete: false, failed: true, progress: 0, note };
  }
}
