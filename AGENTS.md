# AGENTS.md

pnpm monorepo: Chrome Extension (MV3) + Hono/Bun 服务端。Package manager is **pnpm** (`pnpm-lock.yaml`), Node >= 22, Bun >= 1.3.

## Workspace layout

```
apps/extension/       Vite 8 + Vue 3 + Element Plus + TypeScript (MV3)
apps/server/          Hono + Bun (HTTP + WebSocket)
packages/shared/      共享类型、协议、常量
packages/create-vite-crx/   脚手架 CLI
```

## Commands

- `pnpm dev` — 并行启动 `@vite-crx/extension` 的 dev（watch 构建）与 `@vite-crx/server` 的 dev（`bun --hot`）。扩展输出到仓库根目录 `local/`。
- `pnpm dev:extension` — 仅启动扩展 watch 构建。
- `pnpm dev:server` — 仅启动服务端。
- `pnpm build` — 生产构建扩展，产物在仓库根目录 `extension/`。
- `pnpm lint` — `eslint apps/extension/src packages`（flat config）。
- `pnpm typecheck` — 全工作区 `--if-present typecheck`。
- `pnpm test` — 全工作区 `--if-present test`。扩展测试用 vitest（node env），服务端测试用 `bun test`，shared 用 vitest。
- `pnpm build:cli` / `pnpm pack:cli` — 构建 / 打包脚手架 CLI。
- Pre-commit hook runs `lint-staged` → `eslint --quiet` on staged files.

## Extension build architecture (`apps/extension/`)

- `const.ts` is the source of truth for environment: `__DEV__` and `outputDir` (`local` vs `extension`) are driven by `CRX_ENV` env var.
- `package.json` has `"type": "module"`. Vite configs are ESM and use `import.meta.dirname` + explicit `.ts` import extensions (required by Vite 8's native config loader). `scripts/monitor.js` is ESM.
- Two separate Vite configs, run in parallel by `pnpm dev` / `pnpm build`:
  - `vite.config.ts` → `background` + `popup` + `options` + `sidepanel` entries, ES format. Element Plus `AutoImport`/`Components` resolvers live in `commonConfig`, so **all** builds get auto-imported components (they generate `src/auto-imports.d.ts` / `src/components.d.ts` — never hand-edit those).
  - `vite.content.config.ts` → `contentScript` entry, **IIFE format**, output under `contentScript/` subdir. Includes an inline CSS plugin that rewrites `:root` → `:host` (shadow DOM) and guarantees `contentScript/style.css` is always emitted.
- To add a new extension page/script, register its entry in the relevant `rollupOptions.input` **and** wire copying in `scripts/monitor.js`.
- `src/manifest.json` (not `public/`) is the extension manifest. Background SW is `/background/index.js` (`"type"`: `"module"`), content script `/contentScript/index.js`.

## Hot reload (dev only, extension)

WebSocket server on port **8801** (`bgUpdatePort` in `const.ts`). `scripts/hot-reload/injectCode.js` is appended to the background bundle in dev: background changes trigger `chrome.runtime.reload()`, content script changes re-inject the bundle via `chrome.scripting.executeScript`. Changes only propagate if the extension is loaded from `local/`.

## Server (`apps/server/`)

Hono + Bun。`bun --hot src/index.ts` 提供热重载。
- `GET /api/health` — 健康检查
- `GET /ws` — WebSocket 升级端点
- 心跳由服务端定时发 ping，客户端回 pong；超时则服务端断开连接。
- 端口 / 地址常量来自 `packages/shared`（`SERVER_PORT = 8787`）。

## Code conventions

- Typed messaging: the taskId contract lives in `apps/extension/src/shared/message.ts` (`TaskMap`). `sendMessage` (page → background), `sendMessageToTab` (background → contentScript), `onMessage(taskId, cb)`.
- `apps/extension/src/contentScript/index.ts` mounts Vue into a shadow DOM container.
- Path alias `~/` → `apps/extension/src/` (in both Vite configs and `tsconfig.json`).
- `tsconfig.json` has `strict: false`; `moduleResolution: "bundler"`.
- Lint config is flat (`eslint.config.mjs`).
- Commit messages in this repo are written in Chinese.
