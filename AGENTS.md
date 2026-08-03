# AGENTS.md

Chrome Extension (MV3) template. Vite + Vue 3 + Element Plus + TypeScript. Package manager is **pnpm** (`pnpm-lock.yaml`), Node >= 22.

## Commands

- `pnpm dev` — production-style `vite build` **in watch mode**; there is **no dev server**. Output goes to `local/` and is reloaded live. Load it via `chrome://extensions` → Developer mode → Load unpacked.
- `pnpm build` — `rimraf extension`, runs both builds + `scripts/monitor.js`. Output goes to `extension/`.
- `pnpm lint` — `eslint src` (flat config). There is **no build-time lint** anymore; `vite-plugin-eslint` was removed.
- `pnpm typecheck` — `vue-tsc --noEmit`.
- Pre-commit hook runs `lint-staged` → `eslint --quiet` on staged files. No test suite exists.

## Build architecture

- `const.ts` is the source of truth for environment: `__DEV__` and `outputDir` (`local` vs `extension`) are driven by `CRX_ENV` env var (set by `cross-env` in the npm scripts).
- `package.json` has `"type": "module"`. Vite configs are ESM and use `import.meta.dirname` + explicit `.ts` import extensions (required by Vite 8's native config loader — don't remove them). `scripts/monitor.js` is ESM.
- Two separate Vite configs, run in parallel by `pnpm dev` / `pnpm build`:
  - `vite.config.ts` → `background` + `popup` entries, ES format.
  - `vite.content.config.ts` → `contentScript` entry, **IIFE format**, output under `contentScript/` subdir. Element Plus `AutoImport`/`Components` resolvers run **only here**, and an inline `vite-content-script-css` plugin (a `generateBundle` hook with `enforce: 'post'`) rewrites `:root` → `:host` in the bundled CSS (needed for shadow DOM) and guarantees `contentScript/style.css` is always emitted (empty if the bundle has no CSS) — the content script loads it via `chrome.runtime.getURL()`, so it must never 404. They also generate `src/auto-imports.d.ts` / `src/components.d.ts` — never hand-edit those.
- To add a new extension page/script, you must register its entry in the relevant `rollupOptions.input` **and** wire copying in `scripts/monitor.js` (which copies `manifest.json`, `src/assets`, and popup HTML, rewriting `.ts` → `.js` in HTML).
- `scripts/monitor.js` runs after build; in dev it also watches `src/manifest.json` and HTML for changes.
- `src/manifest.json` (not `public/`) is the extension manifest. Background SW is `/background/index.js` (declared `"type": "module"`), content script `/contentScript/index.js`, popup `/popup/index.html`; the content script's CSS is loaded via `chrome.runtime.getURL()` and must stay in `web_accessible_resources`.

## Hot reload (dev only)

WebSocket server on port **8801** (`bgUpdatePort` in `const.ts`). `scripts/hot-reload/injectCode.js` is appended to the background bundle in dev: background changes trigger `chrome.runtime.reload()`, content script changes re-inject the bundle into the active tab via `chrome.scripting.executeScript`. Changes only propagate if the extension is loaded from `local/`.

## Code conventions

- Messaging is taskId-based: `chrome.runtime.sendMessage({ taskId, params })` (promise style) + `onMessage(taskId, cb)` from `src/background/utils.ts` / `src/contentScript/utils.ts`. `onMessage` uses `sendResponse` and **must `return true`** to keep the async channel open. Background registers `get-value-bg` / `set-value-bg` / `del-value-bg` via `src/background/db.ts` (idb IndexedDB wrapper, `crx_index_db`/`crx_bg_table`); content script wraps them as `getCache`/`setCache`/`delCache`.
- `src/contentScript/index.ts` mounts Vue into a shadow DOM container (`#vite_crx_content_script`); in dev it removes the previous root before remounting.
- Path alias `~/` → `src/` (in both Vite configs and `tsconfig.json`).
- `tsconfig.json` has `strict: false`; `moduleResolution: "bundler"` and `allowImportingTsExtensions` are set for Vite-style imports. `__DEV__` and `*.vue` modules are declared globally in `src/global.d.ts`.
- Lint config is flat (`eslint.config.mjs`), not eslintrc; `any` usage is intentionally allowed (template is `strict: false`).
- Commit messages in this repo are written in Chinese.
