# create-vite-crx

Scaffold a Chrome Extension (Manifest V3) project with Vite, Vue, TypeScript, and a Hono/Bun server.

[中文说明](https://github.com/Tinsson/vite-crx-template/blob/master/README_zh.md) · [Source code](https://github.com/Tinsson/vite-crx-template) · [Report an issue](https://github.com/Tinsson/vite-crx-template/issues)

## What's included

- A pnpm monorepo with Vite 8, Vue 3, Element Plus, and TypeScript
- Background service worker, Popup, Options, Side Panel, and Content Script examples
- A Content Script mounted in Shadow DOM, with development hot reload
- A Hono + Bun server with HTTP and WebSocket examples
- Shared types and messaging protocols for the extension and server
- Production builds, unit tests, type checking, and ESLint configuration

## Requirements

- Node.js >= 22
- pnpm >= 11.22.0
- Bun >= 1.3 to run the server
- Chrome >= 116

Install pnpm before running the scaffold command, including when using npm or npx. The generated project uses pnpm to install and manage dependencies.

## Create a project

Using npm:

```bash
npm create vite-crx@latest my-extension
```

Or use pnpm or npx:

```bash
pnpm create vite-crx my-extension
npx create-vite-crx@latest my-extension
```

Provide a project name using lowercase letters, numbers, dots, underscores, or hyphens, starting with a letter or number. The target directory must be new or empty. The CLI creates the project and runs `pnpm install` automatically.

## Start development

```bash
cd my-extension
pnpm dev
```

This starts the extension watch build and the Bun/Hono server at `http://localhost:8787`.

To load the extension in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the generated project's `local/` directory.

Keep `pnpm dev` running while developing. The extension must be loaded from `local/` for development hot reload to work. Reload the extension from `chrome://extensions` after changes to manifest permissions.

## Commands

Run these commands from the generated project's root directory:

```bash
pnpm dev              # Watch the extension and run the server
pnpm dev:extension    # Watch the extension only
pnpm dev:server       # Run the server only
pnpm build            # Build the production extension into extension/
pnpm lint             # Run ESLint
pnpm typecheck        # Type-check all workspace packages
pnpm test             # Run workspace tests
```

To try the production build locally, run `pnpm build`, then use **Load unpacked** in Chrome to load the `extension/` directory.

## Project structure

```text
apps/
  extension/          Chrome Extension (MV3)
  server/             Hono + Bun HTTP/WebSocket server
packages/
  shared/             Shared types, protocols, and constants
```

## Troubleshooting

- **Dependency installation failed:** The generated files are preserved. Run `pnpm install` again inside the project directory.
- **Bun was not found:** Install Bun >= 1.3 to run the server, or use `pnpm dev:extension` to work on the extension alone.
- **The target directory is not empty:** Choose a new project name or an empty directory.

For Chinese documentation and more development details, see the [中文说明 in the repository](https://github.com/Tinsson/vite-crx-template/blob/master/README_zh.md).
