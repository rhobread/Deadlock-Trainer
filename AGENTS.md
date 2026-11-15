# Deadlock Trainer

A standalone browser warm-up app for new Deadlock players. Train physical key recall, mouse target acquisition, and mixed inputs. This is an unofficial fan project, not a game integration or cheat.

## Stack and Commands

- TypeScript, Vite, native DOM and CSS. No backend, analytics, or accounts.
- `npm install` installs dependencies; `npm run dev` serves locally.
- `npm run build` type-checks and builds; `npm test` runs logic tests; `npm run test:e2e` runs browser tests.
- Keep changes small and accessible. Preserve keyboard focus, responsive layouts, reduced-motion support, and local-only data.

## Permissions and Boundaries

- Edit project files and run local build/test tooling as needed.
- The user authorized committing and pushing this project to `https://github.com/rhobread/Deadlock-Trainer` for the initial delivery. Future agents should follow the current user's explicit Git instructions rather than treating this as indefinite authorization.
- Steam and Deadlock folders are strictly READ-ONLY. Never modify configs, install mods, inject input, attach to the game, read process memory, or automate gameplay.
- Do not commit Steam files, account identifiers, absolute personal paths, credentials, or tokens. Only general key mappings belong in the app.
- Imports are user-selected text files parsed locally in the browser. Never upload their contents.

## Behavior

- Settings, bindings, and recent session summaries live only in browser localStorage.
- Aim training is 2D target acquisition, not a promise of matched in-game sensitivity, recoil, movement, or mechanics.
- Escape pauses; leaving the page pauses automatically. No global keyboard listeners outside active practice or explicit rebinding.
- Validate with unit tests, a production build, and browser interaction tests before delivery.
