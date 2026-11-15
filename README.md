# Deadlock Trainer

A standalone warm-up room for new Deadlock players. Practice physical key recall, held melee, overlapping movement/crouch/zoom/fire, and independent releases in an original third-person practice range.

This can help input familiarity and hand coordination. It is not evidence that your in-game aim or combat will improve, and it does not replace Deadlock's sandbox. The range uses original primitive geometry and a combat-oriented HUD, not a copy of the game's map, hero assets, or engine.

Unofficial fan project. Not affiliated with Valve. This app never connects to Deadlock, changes game files, or automates gameplay.

## Launch

Install [Node.js](https://nodejs.org/) 22.12 or newer, then open a terminal in this project folder:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in your browser. Vite prints the actual address if that port is already busy. Keep the terminal open while practicing. Press `Ctrl+C` in the terminal to stop the server.

To download the project on another computer:

```sh
git clone https://github.com/rhobread/Deadlock-Trainer.git
cd Deadlock-Trainer
npm install
npm run dev
```

## How to Practice

1. Pick a mode from the left sidebar. On small screens, use the three mode icons at the top.
2. Choose a 30, 60, or 120 second session and a difficulty.
3. For key practice, select all keys or a smaller group such as abilities or movement. Leave **Training wheels** enabled to see the expected key; turn it off when you feel comfortable.
4. Click **Start training**. Follow the objective: tap, continuously hold, release one control while keeping others down, or fire at the target. The **HELD NOW** HUD shows what is actually down. Sequential taps do not pass a simultaneous hold. Misses, interrupted relevant holds, and timed-out prompts count against accuracy.
5. Press `Escape` or use the pause button for a break. Switching away from the app or resizing the window pauses automatically. Resume explicitly when ready.
6. Review correct inputs, accuracy, and median response time. **Go again** starts another session; **Back to setup** lets you adjust your practice.

### Modes

| Mode           | What you practice                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Keybind recall | Physical key recall for movement, combat, abilities, and active items.                                            |
| Soul practice  | Acquire rising souls in the third-person practice lane.                                                           |
| Combat range   | Held/chord/tap/release drills, directional dash-jumps, dash-slide sequences, and combined movement/mouse actions. |

Rookie gives you larger targets and longer response windows. Regular and Sharpshooter progressively reduce target size and available time. Accuracy comes before speed.

### Camera and Combat HUD

The 3D lane contains a shoulder-view training character, target troopers, rising souls, cover props, and a melee training partner. Movement translates the camera; crouch lowers it; dash and jump respond to fresh key-down edges rather than repeating while held. Targets are scored against their actual meshes, not the rectangular accessible target proxy.

- **Free cursor:** the default, beginner-friendly mode. Aim with the cursor and use your fire binding. It is less game-like than captured mouse look.
- **Capture mouse:** after starting, click this button for relative camera look with a centered crosshair. **Escape** pauses and releases the mouse. Resuming does not silently re-capture it; click capture again.
- **Fullscreen:** expands the range. While running it also requests mouse capture and, when supported, the browser's Keyboard Lock API. Unsupported or denied capture leaves free-cursor practice available.
- **Mouse-look speed:** changes only this trainer's camera speed, not an in-game sensitivity conversion.
- **Weapon model:** a generic 12-round practice weapon, 160 ms firing cadence, and 1.4 second reload. Hold fire for automatic fire. These are training values, not any hero's weapon stats.
- **HUD:** ability/item slots and bindings respond to held inputs. Health is display-only; the mini-map is a schematic. There is no damage or stamina balance simulation.
- **Fallback:** without WebGL, targeting falls back to the local 2D drill. Hold/chord rules still work. Reduced-motion settings stop soul drift and camera bob.

The range does **not** reproduce exact Deadlock camera offsets, sensitivity, animations, recoil, collision, slide momentum, stamina, damage, parry windows, or hero-specific alternate fire. Finish in Deadlock's sandbox. Chord drills require a physical keyboard and mouse; touch devices can use free-cursor targeting and settings.

### Combat Drills

Choose **Combat range** (the third mode), then select a drill or rotate through all twelve:

| Situation                    | Input rehearsal                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Last hit, then secure        | Fire at the low-health trooper, then acquire its rising soul.                                                                                      |
| Contest the enemy soul       | Deny the released soul, then move toward the indicated cover.                                                                                      |
| Read the heavy melee         | Recognize a heavy-melee cue, find parry, then create space.                                                                                        |
| Dash into a jump             | Hold forward, press dash, then jump on the blue cue. Dash may remain held, but is not required to.                                                 |
| Cover, then reload           | Move toward indicated cover, then reload.                                                                                                          |
| Move and contest             | Keep your strafe key held while shooting the enemy soul.                                                                                           |
| Light melee                  | Make a short melee tap, then hold a diagonal movement chord.                                                                                       |
| Heavy melee                  | Hold through the charge cue; the heavy commits while still held. Release only to re-arm the next input.                                            |
| Movement + heavy melee       | Keep forward + right held while holding melee, then release melee without dropping movement.                                                       |
| Crouch + heavy melee         | Hold crouch and melee together; release melee first, then crouch separately. This is coordination practice, not a special damage technique.        |
| Dash, crouch, shoot, release | Hold forward, dash with crouch released, add crouch, shoot with both still held, then release crouch only.                                         |
| Strafe + zoom + fire         | Overlap movement, held zoom, and primary fire, then release zoom independently. Assumes a zoom-capable practice weapon, not every hero's alt-fire. |

Drills use editable/imported bindings except the explicitly labeled optional safe crouch override below. Pausing clears held inputs and partial hold credit. Re-establish the inputs after resuming. A paused dash-jump restarts from dash rather than allowing a jump against a stale window. A timed-out step restarts the situation.

**Training timing:** light taps are graded on release with a 250 ms maximum; heavy holds use a 500 ms continuous training threshold. These are not verified Deadlock tap/hold cutoffs. Light grading on release does not mean the game's light attack fires on release. Heavy commitment does not require release.

Dash-jump opens a blue cue 300 ms after dash input. Rookie keeps it open until 900 ms, Regular until 700 ms, and Sharpshooter until 550 ms. The sharp 300-550 ms cue follows the June 30, 2026 reference below; the other windows deliberately provide assistance. None is certified against the installed engine. OS key-repeat events cannot satisfy holds or trigger repeated dashes/jumps.

Cover/enemy cues, soul motion, and soul colors are illustrative. A soul shot follows a **ranged** last hit here, never a melee last hit.

### Browser Shortcut Safety

**Ctrl+W can close the tab, and other Ctrl/Alt chords can activate browser or OS shortcuts.** Fullscreen and `preventDefault` are not universal fixes. Keyboard Lock has limited support and cannot capture every OS-reserved shortcut. Repeated Shift can also trigger the operating system's Sticky Keys prompt.

**Browser-safe crouch is on by default for Combat range.** If the saved crouch binding contains Ctrl, the drill uses **Caps Lock** instead and labels it in the objective/HUD. This changes only the effective training input, not the saved/imported binding or any game file. The keybind dialog still shows your original Ctrl binding. The toggle does not affect key recall or soul practice. Custom non-Ctrl crouch bindings are preserved.

Keep this on for forward+crouch or crouch+melee chords unless you deliberately choose another safe binding or understand your browser's capture limitations. Caps Lock may toggle typing capitalization; physical-key matching does not depend on capitalization. If you need exact Ctrl chords without browser interruption, Deadlock's sandbox is the reliable option. Do not disable OS safeguards just for the trainer.

### Mechanics References

Control identifiers were checked against the installed Deadlock control manifest, but legacy labels are not reliable proof of current mechanics. Research references:

| Mechanic               | Reference and implementation boundary                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap vs hold melee      | [Melee Attack](https://deadlock.wiki/Melee_Attack) and [Heavy Melee](https://deadlock.wiki/Heavy_Melee): heavy advances through windup/lunge while held. The animation windup is not proof of a tap/hold cutoff.            |
| Dash-jump cue          | [Dash-jump page](https://deadlock.wiki/Dashing/Dash_Jumping) and [June 30, 2026 patch reproduction](https://deadlock.wiki/Update:June_30,_2026): 0.30-0.55 seconds. Some general wiki text still describes an older window. |
| Dash-slide and release | [Dash Sliding](https://deadlock.wiki/Dashing/Dash_Sliding) and [Sliding](https://deadlock.wiki/Sliding): add crouch after dash; release cancels slide; actual sliding depends on speed/state/slope.                         |
| Move + fire / zoom     | [Move Speed](https://deadlock.wiki/Move_Speed) and the game's `ADS` label **Zoom/Alternate Fire**: do not generalize one hero's RMB behavior to every hero.                                                                 |
| Souls                  | [Floating soul orbs](https://deadlock.wiki/Souls#Floating_orbs): ranged last-hit follow-up versus melee-secured last hits.                                                                                                  |
| Urn/parry              | [Soul Urn](https://deadlock.wiki/Soul_Urn) and the June 30 reference: urn carriers cannot parry or manually drop the urn. No obsolete “parry key drops urn” drill is taught.                                                |
| Browser capture        | [Keyboard Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/lock): support and OS-granted keys vary.                                                                                                      |

The patch reproduction links to [Valve's announcement](https://steamcommunity.com/games/1422450/announcements/detail/688635449342692004). Its full body was not independently extractable during research; patch details above rely on the community reproduction. References can change and are not a guarantee that this trainer tracks every patch.

## Your Keybinds

The initial controls follow general mappings observed during setup, including `Q` melee, `F` parry, `Shift` dash, `Ctrl` crouch, `Space` jump, `1`-`4` abilities, `Z`/`X`/`C`/`V` active items, left mouse fire, and right mouse zoom/alternate fire. Check these against your settings. Hold-input drills assume hold-to-crouch, not a toggle-crouch configuration.

- Open **Your keybinds**, or click **EDIT** beside the quick reference.
- Click an action's key, then press a new key. Hold a modifier with a letter/number for a combination, or press and release a modifier alone. To bind a mouse button, click the listening keycap again with that button.
- Press `Escape` to cancel rebinding. Browser and operating-system shortcuts may not be capturable; plain letters and numbers are the most reliable choices. Function keys, Tab, Escape, and system-key shortcuts are not offered for manual rebinding.
- Use **Reset defaults** to restore the starting controls. Changing a binding here never changes Deadlock itself.

### Import From Deadlock

Click **Import Deadlock .lst** and select `citadelkeys_personal.lst`. It is usually under your Steam installation in:

```text
userdata/<your-user-folder>/1422450/remote/cfg/citadelkeys_personal.lst
```

Only supported training actions are imported. Primary keys and their modifiers are used; a supported secondary key can be used if the primary is unbound. Escape, Tab, function keys, and system-key shortcuts are skipped because the browser or trainer reserves them. Hero-specific overrides and unrelated game settings are not imported. Unsupported actions are ignored. Review the bindings after importing.

The file is read in your browser and is never uploaded. Do not add your Steam files or personal account paths to this repository.

## Privacy

No accounts, backend, analytics, or game integration. Fonts are bundled locally. Settings, keybind overrides, and up to 20 recent session summaries are stored only in this browser's `localStorage`. The sidebar shows the last session for the selected mode. Clearing site data resets this information; different browsers and origins have separate storage. If browser storage is blocked, training still works but progress is temporary.

## Production Build

```sh
npm run build
npm run preview
```

Open the preview address printed in the terminal, usually **http://127.0.0.1:4173**. The generated `dist` folder can be served by a static web host. Local development does not require deployment or GitHub Pages.

## Tests

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover native-shaped keyboard events, simultaneous physical input state, both Shift keys, mouse chords, tap/hold/release grading, repeats, binding imports, scenario definitions, fallback geometry, saved-data validation, and statistics. Browser tests exercise continuous heavy holds, interrupted overlaps, diagonal movement, crouch release, simultaneous mouse buttons, custom bindings, firing/reload, pause/reset, 3D targeting, capture, WebGL fallback, saved progress, and desktop/mobile layouts.

## Code Layout

- `index.html`: accessible page markup, separate from application logic.
- `src/main.ts`: session lifecycle, DOM updates, and browser input handling.
- `src/trainer.ts`: action catalog, physical-key normalization, binding parser, and statistics.
- `src/drills.ts`: lane scenario definitions, held-key rules, and target geometry.
- `src/input.ts`: physical keyboard/mouse state and the pure tap/hold/chord/release evaluator.
- `src/range.ts`: original Three.js lane, shoulder camera, movement cues, target meshes, and raycasts.
- `src/storage.ts`: typed settings/history validation and local persistence.
- `src/style.css`: responsive visuals and reduced-motion styling.
- `src/combat.css`: game-oriented practice HUD and fullscreen range styling.
- `src/*.test.ts` and `tests/*.spec.ts`: pure logic tests and browser regression tests.

## Agent Access

The public [AGENTS.md](AGENTS.md) records the authorized project work and narrow read-only Steam references. Machine-specific paths live in ignored `AGENTS.local.md`, with narrow machine-local Kilo rules in ignored `.kilo/kilo.json`. These rules do not disable editor/sandbox safeguards or mandatory Git confirmations and may need a new session to load.

`.gitignore` excludes dependencies, build/test output, local machine paths/settings, secrets, browser authentication data, and raw imported game files. Do not force-add those files to GitHub.

Project boundaries and guidance for coding agents are in [AGENTS.md](AGENTS.md). Steam and Deadlock files must remain read-only.
