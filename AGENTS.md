# Deadlock Trainer

A standalone browser warm-up app for new Deadlock players. Train physical key recall, mouse target acquisition, and mixed inputs. This is an unofficial fan project, not a game integration or cheat.

## Stack and Commands

- TypeScript, Vite, native DOM/CSS, and Three.js for the original practice range. No backend, analytics, or accounts.
- `npm install` installs dependencies; `npm run dev` serves locally.
- `npm run build` type-checks and builds; `npm test` runs logic tests; `npm run test:e2e` runs browser tests.
- Keep changes small and accessible. Preserve keyboard focus, responsive layouts, reduced-motion support, and local-only data.

## Permissions and Boundaries

- Edit project files and run local build/test tooling as needed.
- The user explicitly authorized committing and pushing the app, requested improvements, README, and access guidance to `https://github.com/rhobread/Deadlock-Trainer`. Stage only public-safe project files. Future unrelated tasks still need their own current Git instructions.
- Steam and Deadlock folders are strictly READ-ONLY. Never modify configs, install mods, inject input, attach to the game, read process memory, or automate gameplay.
- Do not commit Steam files, account identifiers, absolute personal paths, credentials, or tokens. Only general key mappings belong in the app.
- Imports are user-selected text files parsed locally in the browser. Never upload their contents.

## Authorized Paths

- The repository root and its source, tests, dependencies, and generated build/test folders are the project work area. Local build and test tooling is authorized; do not repeatedly ask to perform ordinary work already within this scope.
- Read `AGENTS.local.md` when present for this machine's project and Steam paths. That file and `.kilo/kilo.json` are intentionally ignored by Git; never force-add them or repeat their personal paths in tracked files.
- Steam references are limited to locating the game through `steamapps/libraryfolders.vdf`, inspecting Deadlock's `steamapps/common/Deadlock/game/citadel/cfg/` controls, and reading `userdata/<user-folder>/1422450/remote/cfg/citadelkeys_personal.lst` when needed for bindings. Do not inspect unrelated Steam account/session data.
- Steam and Deadlock remain read-only even when a tool grants access to their directories. No writes, deletes, renames, permissions changes, or game/process automation are authorized there.
- Agent instructions record user authorization, not an approval bypass. Honor runtime sandbox, editor, and tool approvals; do not disable safeguards or add broad shell allowances to suppress prompts. Machine-local Kilo rules may pre-approve the listed read-only references, but do not override higher-priority restrictions or one-shot Git approvals.

## Behavior

- Settings, bindings, and recent session summaries live only in browser localStorage.
- Aim training uses a simplified third-person range with a 2D fallback, not matched in-game sensitivity, recoil, movement, or mechanics.
- Keep Basic Manual's single-key, click-target, and alternating drills alongside the 3D modes. Basic practice must not initialize or download the 3D renderer, require weapon reloads, or turn held clicks into auto-fire. Preserve existing saved modes and bindings when adding modes.
- Lane situations rehearse real action mappings and input order, not exact parry/dash timing, stamina, collision, damage, or hero-specific tactics. Keep scenario definitions separate from rendering and saved-data validation.
- Ranged last-hit drills may lead into a soul shot; do not teach a soul shot after a melee last hit. Soul colors and motion are training cues, not game-accurate visuals or physics.
- Heavy melee commits while held; release only re-arms a later input. Light-tap grading on release is a trainer duration check, not a claim that the game fires light attacks on release. Label training thresholds and patch-sensitive dash-jump cues clearly.
- Track physical input sources and continuous overlap, not OS key-repeat counts. Mouse chords require every button edge; pointerdown/pointerup alone miss intermediate mouse presses/releases. Keep browser tests for movement + RMB + LMB.
- Browser-safe crouch is an explicit trainer-only Caps Lock override for Ctrl-based crouch in Combat range. Preserve imported bindings and never modify the actual game. Fullscreen/Keyboard Lock cannot guarantee capture of OS/browser shortcuts; release capture on pause, blur, or finish.
- Range artwork is original primitive geometry; do not extract or commit game assets. Mesh raycasts must match visible targets. Preserve no-WebGL fallback and reduced-motion support.
- Current urn references say carriers cannot parry or manually drop the urn; do not infer live mechanics from legacy `Parry/Drop Urn` labels. Record sources and research limitations in README.
- Escape pauses; leaving the page pauses automatically. No global keyboard listeners outside active practice or explicit rebinding.
- Validate with unit tests, a production build, and browser interaction tests before delivery.
- Software-rendered 3D browser tests can contend with video playback. Keep the default single browser worker, run builds and browser suites serially, and use targeted lightweight checks for small fixes rather than repeatedly launching the full 3D matrix while the user is working.
