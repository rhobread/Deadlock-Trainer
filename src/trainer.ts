export type Action = {
  id: string;
  label: string;
  key: string;
  group: "movement" | "combat" | "abilities" | "items";
  tip: string;
};

export const ACTIONS: Action[] = [
  {
    id: "MoveForward",
    label: "Move Forward",
    key: "W",
    group: "movement",
    tip: "Advance toward your target.",
  },
  {
    id: "MoveBackwards",
    label: "Move Backward",
    key: "S",
    group: "movement",
    tip: "Back away while keeping your aim on target.",
  },
  {
    id: "MoveLeft",
    label: "Move Left",
    key: "A",
    group: "movement",
    tip: "Strafe left to change your angle.",
  },
  {
    id: "MoveRight",
    label: "Move Right",
    key: "D",
    group: "movement",
    tip: "Strafe right to change your angle.",
  },
  {
    id: "Mantle",
    label: "Jump / Mantle",
    key: "SPACE",
    group: "movement",
    tip: "Jump or mantle onto a ledge.",
  },
  {
    id: "Roll",
    label: "Dodge / Roll",
    key: "SHIFT",
    group: "movement",
    tip: "Dodge to reposition or avoid damage.",
  },
  {
    id: "Crouch",
    label: "Crouch / Slide",
    key: "CTRL",
    group: "movement",
    tip: "Crouch or slide while moving.",
  },
  {
    id: "AbilityMelee",
    label: "Melee",
    key: "Q",
    group: "combat",
    tip: "Use melee against a nearby opponent.",
  },
  {
    id: "HeldItem",
    label: "Parry",
    key: "F",
    group: "combat",
    tip: "Time your parry against an incoming melee attack.",
  },
  {
    id: "Reload",
    label: "Reload",
    key: "R",
    group: "combat",
    tip: "Reload when you have a safe opening.",
  },
  {
    id: "Interact",
    label: "Interact",
    key: "E",
    group: "combat",
    tip: "Interact with the object in front of you.",
  },
  {
    id: "Ability1",
    label: "Ability 1",
    key: "1",
    group: "abilities",
    tip: "Activate your first hero ability.",
  },
  {
    id: "Ability2",
    label: "Ability 2",
    key: "2",
    group: "abilities",
    tip: "Activate your second hero ability.",
  },
  {
    id: "Ability3",
    label: "Ability 3",
    key: "3",
    group: "abilities",
    tip: "Activate your third hero ability.",
  },
  {
    id: "Ability4",
    label: "Ability 4",
    key: "4",
    group: "abilities",
    tip: "Activate your fourth hero ability.",
  },
  {
    id: "Item1",
    label: "Item 1",
    key: "Z",
    group: "items",
    tip: "Activate the item in your first slot.",
  },
  {
    id: "Item2",
    label: "Item 2",
    key: "X",
    group: "items",
    tip: "Activate the item in your second slot.",
  },
  {
    id: "Item3",
    label: "Item 3",
    key: "C",
    group: "items",
    tip: "Activate the item in your third slot.",
  },
  {
    id: "Item4",
    label: "Item 4",
    key: "V",
    group: "items",
    tip: "Activate the item in your fourth slot.",
  },
];

const modifiers = ["CTRL", "ALT", "SHIFT", "META"] as const;
const supportedIds = new Set(ACTIONS.map((action) => action.id));
const keyAliases = new Map<string, string>([
  [" ", "SPACE"],
  ["SPACEBAR", "SPACE"],
  ["ESC", "ESCAPE"],
  ["RETURN", "ENTER"],
  ["CONTROL", "CTRL"],
  ["CONTROLLEFT", "CTRL"],
  ["CONTROLRIGHT", "CTRL"],
  ["LCTRL", "CTRL"],
  ["RCTRL", "CTRL"],
  ["LCONTROL", "CTRL"],
  ["RCONTROL", "CTRL"],
  ["SHIFTLEFT", "SHIFT"],
  ["SHIFTRIGHT", "SHIFT"],
  ["LSHIFT", "SHIFT"],
  ["RSHIFT", "SHIFT"],
  ["ALTLEFT", "ALT"],
  ["ALTRIGHT", "ALT"],
  ["LALT", "ALT"],
  ["RALT", "ALT"],
  ["METALEFT", "META"],
  ["METARIGHT", "META"],
  ["LMETA", "META"],
  ["RMETA", "META"],
  ["WIN", "META"],
  ["LWIN", "META"],
  ["RWIN", "META"],
  ["OS", "META"],
  ["COMMAND", "META"],
  ["UP", "ARROWUP"],
  ["DOWN", "ARROWDOWN"],
  ["LEFT", "ARROWLEFT"],
  ["RIGHT", "ARROWRIGHT"],
  ["PGUP", "PAGEUP"],
  ["PGDN", "PAGEDOWN"],
  ["DEL", "DELETE"],
  ["INS", "INSERT"],
  ["`", "BACKQUOTE"],
  ["-", "MINUS"],
  ["=", "EQUAL"],
  ["[", "BRACKETLEFT"],
  ["]", "BRACKETRIGHT"],
  ["\\", "BACKSLASH"],
  [";", "SEMICOLON"],
  ["'", "QUOTE"],
  [",", "COMMA"],
  [".", "PERIOD"],
  ["/", "SLASH"],
]);
const namedKeys = new Set([
  ...modifiers,
  "SPACE",
  "TAB",
  "ENTER",
  "ESCAPE",
  "BACKSPACE",
  "DELETE",
  "INSERT",
  "HOME",
  "END",
  "PAGEUP",
  "PAGEDOWN",
  "ARROWUP",
  "ARROWDOWN",
  "ARROWLEFT",
  "ARROWRIGHT",
  "CAPSLOCK",
  "NUMLOCK",
  "SCROLLLOCK",
  "PAUSE",
  "PRINTSCREEN",
  "BACKQUOTE",
  "MINUS",
  "EQUAL",
  "BRACKETLEFT",
  "BRACKETRIGHT",
  "BACKSLASH",
  "SEMICOLON",
  "QUOTE",
  "COMMA",
  "PERIOD",
  "SLASH",
  "NUMPADADD",
  "NUMPADSUBTRACT",
  "NUMPADMULTIPLY",
  "NUMPADDIVIDE",
  "NUMPADDECIMAL",
  "NUMPADENTER",
  "NUMPADEQUAL",
]);

function normalizeKey(value: string): string {
  if (value === " ") return "SPACE";
  let key = value.trim().toUpperCase().replace(/^KEY_/, "");
  if (/^KEY[A-Z]$/.test(key)) key = key.slice(3);
  if (/^DIGIT[0-9]$/.test(key)) key = key.slice(5);
  key = keyAliases.get(key) ?? key;
  return /^[A-Z0-9]$/.test(key) ||
    /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key) ||
    /^NUMPAD[0-9]$/.test(key) ||
    namedKeys.has(key)
    ? key
    : "";
}

function combineKeys(key: string, activeModifiers: Iterable<string>): string {
  const active = new Set(activeModifiers);
  const isModifier = modifiers.some((modifier) => modifier === key);
  if (isModifier) active.add(key);
  return [
    ...modifiers.filter((modifier) => active.has(modifier)),
    ...(isModifier ? [] : [key]),
  ].join("+");
}

export function keyFromEvent(
  event: Pick<
    KeyboardEvent,
    "code" | "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
  >,
): string {
  const key = normalizeKey(event.code) || normalizeKey(event.key);
  if (!key) return "";
  const active: string[] = [];
  if (event.ctrlKey) active.push("CTRL");
  if (event.altKey) active.push("ALT");
  if (event.shiftKey) active.push("SHIFT");
  if (event.metaKey) active.push("META");
  return combineKeys(key, active);
}

export function displayKey(key: string): string {
  const labels: Record<string, string> = {
    CTRL: "Ctrl",
    ALT: "Alt",
    SHIFT: "Shift",
    META: "Meta",
    SPACE: "Space",
    ENTER: "Enter",
    ESCAPE: "Esc",
    TAB: "Tab",
    BACKSPACE: "Backspace",
    DELETE: "Delete",
    INSERT: "Insert",
    HOME: "Home",
    END: "End",
    PAGEUP: "Page Up",
    PAGEDOWN: "Page Down",
    ARROWUP: "Up",
    ARROWDOWN: "Down",
    ARROWLEFT: "Left",
    ARROWRIGHT: "Right",
    CAPSLOCK: "Caps Lock",
    NUMLOCK: "Num Lock",
    SCROLLLOCK: "Scroll Lock",
    BACKQUOTE: "`",
    MINUS: "-",
    EQUAL: "=",
    BRACKETLEFT: "[",
    BRACKETRIGHT: "]",
    BACKSLASH: "\\",
    SEMICOLON: ";",
    QUOTE: "'",
    COMMA: ",",
    PERIOD: ".",
    SLASH: "/",
  };
  return key
    .split("+")
    .map((part) => (Object.hasOwn(labels, part) ? labels[part] : part))
    .join("+");
}

function bindingKey(
  key: string | undefined,
  modifier: string | undefined,
): string {
  const normalized = normalizeKey(key ?? "");
  if (!normalized) return "";
  const active: string[] = [];
  if (modifier && modifier.trim().toUpperCase() !== "NONE") {
    for (const part of modifier.split("+")) {
      const value = normalizeKey(part);
      if (!modifiers.some((candidate) => candidate === value)) return "";
      active.push(value);
    }
  }
  return combineKeys(normalized, active);
}

export function parseBindings(text: string): Record<string, string> {
  // Tokenize KeyValues rather than evaluating text or matching braces inside comments/strings.
  const lexer =
    /\s+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"((?:\\.|[^"\\])*)"|([{}])|([^\s{}"/]+)/gy;
  const tokens: { value: string; brace: boolean }[] = [];
  let position = 0;
  while (position < text.length) {
    lexer.lastIndex = position;
    const match = lexer.exec(text);
    if (!match) throw new Error("Invalid bindings syntax.");
    position = lexer.lastIndex;
    if (match[1] !== undefined)
      tokens.push({
        value: match[1].replace(/\\(["\\])/g, "$1"),
        brace: false,
      });
    else if (match[2] !== undefined)
      tokens.push({ value: match[2], brace: true });
    else if (match[3] !== undefined)
      tokens.push({ value: match[3], brace: false });
  }

  const bindings: Record<string, string> = {};
  const stack: { name: string; fields: Map<string, string> }[] = [
    { name: "", fields: new Map() },
  ];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (token.brace) {
      if (token.value !== "}" || stack.length === 1)
        throw new Error("Invalid bindings block.");
      const block = stack.pop()!;
      if (supportedIds.has(block.name)) {
        const key =
          bindingKey(block.fields.get("key"), block.fields.get("modifier")) ||
          bindingKey(block.fields.get("key2"), block.fields.get("modifier2"));
        if (key) bindings[block.name] = key;
      }
      continue;
    }
    const next = tokens[++index];
    if (!next || (next.brace && next.value !== "{"))
      throw new Error("Missing bindings value.");
    if (next.brace) stack.push({ name: token.value, fields: new Map() });
    else
      stack[stack.length - 1]!.fields.set(
        token.value.toLowerCase(),
        next.value,
      );
  }
  if (stack.length !== 1) throw new Error("Unclosed bindings block.");
  if (Object.keys(bindings).length === 0)
    throw new Error("No supported valid keyboard bindings found.");
  return bindings;
}

export function chooseAction(
  actions: Action[],
  previousId?: string,
  random: () => number = Math.random,
): Action {
  if (actions.length === 0)
    throw new Error("Cannot choose from an empty action list.");
  const alternatives = actions.filter((action) => action.id !== previousId);
  const candidates = alternatives.length > 0 ? alternatives : actions;
  const sample = random();
  const index = Number.isFinite(sample)
    ? Math.max(
        0,
        Math.min(candidates.length - 1, Math.floor(sample * candidates.length)),
      )
    : 0;
  return candidates[index]!;
}

export function accuracy(hits: number, attempts: number): number {
  if (!Number.isFinite(hits) || !Number.isFinite(attempts) || attempts <= 0)
    return 0;
  return Math.round(Math.max(0, Math.min(1, hits / attempts)) * 100);
}

export function summarize(reactions: number[]): number {
  const sorted = reactions
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return Math.round(
    sorted.length % 2
      ? sorted[middle]!
      : sorted[middle - 1]! / 2 + sorted[middle]! / 2,
  );
}
