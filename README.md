# Deadlock Trainer

A small, standalone warm-up room for new Deadlock players. Practice your keybinds, get comfortable clicking targets, and build muscle memory before your next match.

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
4. Click **Start training**. Press the key for the displayed action, or left-click the glowing soul before it disappears. Misses count against accuracy. Timed-out prompts count as misses too.
5. Press `Escape` or use the pause button for a break. Switching away from the app or resizing the window pauses automatically. Resume explicitly when ready.
6. Review correct inputs, accuracy, and median response time. **Go again** starts another session; **Back to setup** lets you adjust your practice.

### Modes

| Mode           | What you practice                                                      |
| -------------- | ---------------------------------------------------------------------- |
| Keybind recall | Physical key recall for movement, combat, abilities, and active items. |
| Soul practice  | 2D target acquisition. Click each soul before its timer expires.       |
| Mixed training | Alternating keybind prompts and clickable souls.                       |

Rookie gives you larger targets and longer response windows. Regular and Sharpshooter progressively reduce target size and available time. Accuracy comes before speed.

Aim practice uses your normal browser cursor. It does **not** reproduce Deadlock's sensitivity, 3D camera, recoil, movement, soul physics, or combat timing. Finish your warm-up in Deadlock's own sandbox for game-specific mechanics. Keyboard practice is intended for a physical keyboard; touch devices can use the aim drill and settings.

## Your Keybinds

The initial controls follow the general key mappings observed during setup, including `Q` melee, `F` parry, `Shift` dash, `Ctrl` crouch, `Space` jump, `1`-`4` abilities, and `Z`/`X`/`C`/`V` active items. Check these against your current in-game settings, since Deadlock updates can change controls.

- Open **Your keybinds**, or click **EDIT** beside the quick reference.
- Click an action's key, then press a new key. Hold a modifier with a letter or number for a combination, or press and release a modifier to bind it on its own.
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

Unit tests cover input normalization, binding imports, prompt selection, and statistics. Browser tests cover scoring, session completion, pause/resume, rebinding, imports, saved progress, storage failure, and desktop/mobile layouts.

Project boundaries and guidance for coding agents are in [AGENTS.md](AGENTS.md). Steam and Deadlock files must remain read-only.
