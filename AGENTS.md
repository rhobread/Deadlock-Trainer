# Deadlock Trainer

A standalone browser warm-up app for new Deadlock players. Train physical key recall, mouse target acquisition, and mixed inputs. This is an unofficial fan project, not a game integration or cheat.

## Stack and Commands

- TypeScript, Vite, native DOM and CSS. No backend, analytics, or accounts.
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
- Aim training is 2D target acquisition, not a promise of matched in-game sensitivity, recoil, movement, or mechanics.
- Lane situations rehearse real action mappings and input order, not exact parry/dash timing, stamina, collision, damage, or hero-specific tactics. Keep scenario definitions separate from rendering and saved-data validation.
- Ranged last-hit drills may lead into a soul shot; do not teach a soul shot after a melee last hit. Soul colors and motion are training cues, not game-accurate visuals or physics.
- Escape pauses; leaving the page pauses automatically. No global keyboard listeners outside active practice or explicit rebinding.
- Validate with unit tests, a production build, and browser interaction tests before delivery.
