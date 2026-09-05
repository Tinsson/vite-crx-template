# vite-crx-template

[![npm version](https://img.shields.io/npm/v/create-vite-crx.svg)](https://www.npmjs.com/package/create-vite-crx)

Chrome Extension (MV3) + Hono/Bun 服务端最小可用模板。pnpm monorepo，一键脚手架生成。

## 环境要求

- Node.js >= 22
- pnpm >= 11.22.0（见根 `package.json` 的 `packageManager`）
- Bun >= 1.3（server 运行时）

## 目录结构

```
apps/
  extension/          Chrome 扩展（Vite 8 + Vue 3 + Element Plus + TypeScript）
  server/             Hono + Bun 服务（HTTP + WebSocket）
packages/
  shared/             扩展与服务端共享的类型、协议、常量
  create-vite-crx/    脚手架 CLI
```

## 快速开始

脚手架已发布至 npm：[create-vite-crx](https://www.npmjs.com/package/create-vite-crx)。

```bash
# 使用脚手架创建项目
npx create-vite-crx my-project
cd my-project
pnpm dev
```

本地测试脚手架：

```bash
pnpm build:cli      # 构建 CLI 与模板快照
pnpm pack:cli       # 打包为 .tgz，可 npm install -g 或 npx 本地路径
```

## 开发

```bash
pnpm install
pnpm dev            # 同时启动扩展 watch 构建与服务端热重载
```

- `dev:extension` — 仅启动扩展 watch 构建
- `dev:server` — 仅启动服务端

扩展产物输出到仓库根目录 `local/`，在 `chrome://extensions` 开启开发者模式后「加载已解压的扩展程序」选择该目录。

开发构建会在生成 `local/manifest.json` 时自动向 `host_permissions` 添加 `<all_urls>`，供 contentScript 热更新通过 `chrome.scripting.executeScript` 重新注入当前页面；同时会加入连接本地 8801 热更新服务所需的 CSP。源码 `apps/extension/src/manifest.json` 不会被修改，`pnpm build` 生成的生产扩展也不会包含这两项仅开发环境需要的权限。首次加载或开发 manifest 权限变化后，请在 `chrome://extensions` 中重新加载扩展。

## 服务端

| 端点 | 地址 |
|------|------|
| HTTP 健康检查 | `http://localhost:8787/api/health` |
| WebSocket | `ws://localhost:8787/ws` |

Popup 通过 Background 发起 HTTP 健康检查与 WebSocket 连接验证。心跳由服务端定时发送 ping，Background 回复 pong；超时则服务端主动断开。

## 构建与测试

```bash
pnpm build          # 生产构建扩展，产物在仓库根目录 extension/
pnpm typecheck      # 全工作区类型检查
pnpm test           # 全工作区单元测试
pnpm lint           # ESLint 检查
```
