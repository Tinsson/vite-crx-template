# AGENTS.md

Chrome Extension (MV3) template. Vite + Vue 3 + Element Plus + TypeScript. Package manager is **pnpm** (`pnpm-lock.yaml`), Node >= 22.

## Commands

- `pnpm dev` — production-style `vite build` **in watch mode**; there is **no dev server**. Output goes to `local/` and is reloaded live. Load it via `chrome://extensions` → Developer mode → Load unpacked.
- `pnpm build` — `rimraf extension`, runs both builds + `scripts/monitor.js`. Output goes to `extension/`.
- `pnpm lint` — `eslint src` (flat config). There is **no build-time lint** anymore; `vite-plugin-eslint` was removed.
- `pnpm typecheck` — `vue-tsc --noEmit`.
- `pnpm test` — `vitest run` (node env; `vitest.config.ts` is separate from the Vite build configs). Tests live next to source (`*.test.ts`): `src/shared/message.test.ts`, `src/contentScript/utils.test.ts`, `src/background/db.test.ts`. `src/test/setup.ts` polyfills IndexedDB via `fake-indexeddb` and provides a minimal `chrome` mock (`chromeMock`, `dispatch`) — db.ts needs `idb`'s global `indexedDB`/`IDB*` symbols, so don't trim the `Object.assign(globalThis, ...)` in setup.
- Pre-commit hook runs `lint-staged` → `eslint --quiet` on staged files. No E2E suite exists.

## Build architecture

- `const.ts` is the source of truth for environment: `__DEV__` and `outputDir` (`local` vs `extension`) are driven by `CRX_ENV` env var (set by `cross-env` in the npm scripts).
- `package.json` has `"type": "module"`. Vite configs are ESM and use `import.meta.dirname` + explicit `.ts` import extensions (required by Vite 8's native config loader — don't remove them). `scripts/monitor.js` is ESM.
- Two separate Vite configs, run in parallel by `pnpm dev` / `pnpm build`:
  - `vite.config.ts` → `background` + `popup` + `options` + `sidepanel` entries, ES format. Element Plus `AutoImport`/`Components` resolvers live in `commonConfig`, so **all** builds (popup/options/sidepanel/background/contentScript) get auto-imported components (they also generate `src/auto-imports.d.ts` / `src/components.d.ts` — never hand-edit those).
  - `vite.content.config.ts` → `contentScript` entry, **IIFE format**, output under `contentScript/` subdir. Inherits the resolvers from `commonConfig` and adds an inline `vite-content-script-css` plugin (a `generateBundle` hook with `enforce: 'post'`) that rewrites `:root` → `:host` in the bundled CSS (needed for shadow DOM) and guarantees `contentScript/style.css` is always emitted (empty if the bundle has no CSS) — the content script loads it via `chrome.runtime.getURL()`, so it must never 404.
- To add a new extension page/script, you must register its entry in the relevant `rollupOptions.input` **and** wire copying in `scripts/monitor.js` (which copies `manifest.json`, `src/assets`, and the `popup` + `options` + `sidepanel` HTML, rewriting `.ts` → `.js` in HTML). Pages share one merged `style.css` at output root (referenced via `../style.css` in each HTML).
- `scripts/monitor.js` runs after build; in dev it also watches `src/manifest.json` and HTML for changes.
- `src/manifest.json` (not `public/`) is the extension manifest. Background SW is `/background/index.js` (declared `"type"`: `"module"`), content script `/contentScript/index.js`, popup `/popup/index.html`, options `/options/index.html`, side panel `/sidepanel/index.html`; the content script's CSS is loaded via `chrome.runtime.getURL()` and must stay in `web_accessible_resources`.

## Hot reload (dev only)

WebSocket server on port **8801** (`bgUpdatePort` in `const.ts`). `scripts/hot-reload/injectCode.js` is appended to the background bundle in dev: background changes trigger `chrome.runtime.reload()`, content script changes re-inject the bundle into the active tab via `chrome.scripting.executeScript`. Changes only propagate if the extension is loaded from `local/`.

## Code conventions

- Typed messaging: the taskId contract lives in `src/shared/message.ts` (`TaskMap` — add a key to get full params/response inference). `sendMessage` (page → background), `sendMessageToTab` (background → contentScript via `tabs.sendMessage`), `onMessage(taskId, cb)` (async `sendResponse` — must `return true` to keep the channel open). Handlers are registered in `src/background/db.ts` (`get-value-bg`/`set-value-bg`/`del-value-bg`, idb wrapper `crx_index_db`/`crx_bg_table`; content script wraps them as `getCache`/`setCache`/`delCache`), `src/background/settings.ts` (`get-setting`/`set-setting` via `chrome.storage.sync`), and `src/background/contextMenu.ts` (context menu + badge demo that pings the active tab's content script).
- `src/contentScript/index.ts` mounts Vue into a shadow DOM container (`#vite_crx_content_script`); in dev it removes the previous root before remounting.
- Path alias `~/` → `src/` (in both Vite configs and `tsconfig.json`).
- `tsconfig.json` has `strict: false`; `moduleResolution: "bundler"` and `allowImportingTsExtensions` are set for Vite-style imports. `__DEV__` and `*.vue` modules are declared globally in `src/global.d.ts`.
- Lint config is flat (`eslint.config.mjs`), not eslintrc; `any` usage is intentionally allowed (template is `strict: false`).
- Commit messages in this repo are written in Chinese.
