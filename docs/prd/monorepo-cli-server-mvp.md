---
title: Vite CRX Monorepo、CLI 与本地服务 MVP
date: 2026-09-03
version: 0.1.0
status: approved
tags:
  - vite-crx
  - prd
  - monorepo
  - cli
  - bun
---

> [!abstract] 一句话摘要
> 将现有 Chrome Extension 模板改造成 pnpm monorepo，提供无交互项目生成 CLI，并通过 Bun + Hono 本地服务验证插件 Background 与服务端的 HTTP/WebSocket 双向通信。

## 背景

当前仓库是基于 Vite、Vue 3、Element Plus 和 TypeScript 的 Manifest V3 Chrome Extension 模板。仓库虽然存在 `pnpm-workspace.yaml`，但尚未声明 workspace package，本质上仍是单包工程。

开发者需要手动克隆仓库、安装依赖并理解插件构建方式；模板也没有可供插件联调的本地服务端。为了降低首次使用成本，本期将仓库改造成可生成、可一键启动、可验证双端通信的最小全栈模板。

## 目标与非目标

### 目标

- 通过 `pnpm create vite-crx <project-name>` 生成一个可运行的新项目。
- 将仓库调整为职责清晰的 pnpm monorepo。
- 通过根目录命令同时启动插件监听构建与 Bun 服务端。
- 在真实 Chrome 扩展中验证 HTTP 和 WebSocket 通信。
- 保留当前插件模板已有的构建、热更新和示例能力。

> [!danger] 不可协商的 MVP 范围
> 本期只聚焦“生成项目、启动两端、验证 HTTP/WS”。不得以未来扩展为由加入数据库、认证、生产部署、动态配置或浏览器自动化基础设施。

### 非目标

> [!failure] 本期明确不做
> - Node.js 服务端兼容。
> - 数据库、认证和业务 CRUD。
> - 动态配置服务地址或端口。
> - HTTPS/WSS 和服务端生产部署。
> - 自动启动、控制或加载 Chrome。
> - WebSocket 房间、广播和业务级无限重连。
> - npm 自动发布和 CI/CD。
> - 浏览器自动化 E2E。
> - 重构 Options、Side Panel、Content Script 等现有示例。

## 用户场景

### 核心场景：创建并启动项目

用户输入：

```bash
pnpm create vite-crx my-extension
cd my-extension
pnpm dev
```

系统行为：

1. CLI 创建 `my-extension/` 并写入完整模板。
2. CLI 自动执行 `pnpm install`。
3. `pnpm dev` 同时启动插件监听构建和 Bun 热更新服务。
4. 插件开发产物写入项目根目录 `local/`。
5. 用户在 Chrome 116+ 中通过“加载已解压的扩展程序”加载 `local/`。

### 核心场景：验证 HTTP

1. 用户打开 Popup。
2. 用户点击“检查服务”。
3. Popup 通过类型化扩展消息请求 Background 执行健康检查。
4. Background 请求 `http://localhost:8787/api/health`。
5. Popup 在 5 秒内显示服务状态和服务端时间，或显示可辨识的失败原因。

### 核心场景：验证 WebSocket

1. Background Service Worker 建立并持有 `ws://localhost:8787/ws`。
2. Popup 查询并显示 Background 返回的连接状态，但自身不建立连接。
3. 用户输入文本并触发 echo。
4. Popup 将请求发送给 Background；Background 通过 WebSocket 发送 `echo-request`。
5. 服务端返回相同 `id` 的 `echo-response`，Popup 在 5 秒内显示结果。
6. Popup 关闭不主动关闭 Background 中的 WebSocket。

## 功能清单

### F1：Monorepo 改造

**优先级：P0**

目标结构：

```text
apps/
  extension/
  server/
packages/
  shared/
  create-vite-crx/
pnpm-workspace.yaml
pnpm-lock.yaml
package.json
```

要求：

- pnpm 统一管理 workspace 和依赖，只保留一个 lockfile。
- 当前插件代码、Vite 配置和构建脚本迁移到 `apps/extension`，行为保持不变。
- `apps/server` 使用 Bun + Hono。
- `packages/shared` 存放插件与服务端共同使用的协议类型和解析逻辑。
- `packages/create-vite-crx` 存放生成器与随 npm 包发布的模板。
- `packages/shared` 可由 Vite 和 Bun 直接消费 TypeScript 源码；MVP 不增加独立发布流程。

### F2：项目生成 CLI

**优先级：P0**

命令：

```bash
pnpm create vite-crx <project-name>
```

要求：

- CLI 完全非交互，只接受一个项目名。
- 模板随 `create-vite-crx` npm 包发布，模板内容与 CLI 版本绑定。
- 生成结果不包含 `create-vite-crx` 的 CLI 源码。
- 项目名写入根 `package.json`，并作为默认扩展显示名称。
- 写入成功后自动执行 `pnpm install`。
- npm 包包含正确的 `bin`、`files` 和发布元数据。
- 本期通过 `npm pack` 和本地 tarball 安装完成验证，不自动执行首次 `npm publish`。

> [!info] 选择内置模板的原因
> 内置模板不会受 GitHub 默认分支变化或下载失败影响，并能保证指定 CLI 版本生成确定的项目结构。依赖安装仍按正常流程访问 npm registry。

### F3：统一开发命令

**优先级：P0**

根目录提供：

```bash
pnpm dev
pnpm dev:extension
pnpm dev:server
```

- `pnpm dev` 并行启动插件端和服务端。
- `pnpm dev:extension` 只启动现有插件 watch build；不新增 Vite dev server。
- `pnpm dev:server` 通过 Bun 热更新模式启动 Hono 服务。
- 插件开发产物继续输出到根目录 `local/`。
- 插件生产构建继续输出到根目录 `extension/`。
- 本期不定义服务端生产构建或部署命令。

### F4：HTTP 健康检查

**优先级：P0**

服务端固定监听 `localhost:8787`，提供：

```http
GET /api/health
```

成功响应：

```json
{
  "status": "ok",
  "timestamp": "2026-09-03T00:00:00.000Z"
}
```

约束：

- `status` 固定为 `ok`。
- `timestamp` 必须是合法 ISO 8601 字符串。
- Popup 不直接执行 `fetch`；必须通过现有类型化消息机制调用 Background。
- Background 固定请求上述 URL，不接受 Popup 或 Content Script 传入任意 URL。
- 请求超时为 5 秒。

### F5：WebSocket Echo 与共享协议

**优先级：P0**

WebSocket 地址固定为：

```text
ws://localhost:8787/ws
```

消息使用最小 JSON 协议，公共字段为：

```ts
type BaseMessage<TType extends string, TData> = {
  type: TType
  id: string
  data: TData
}
```

MVP 只定义四类消息：

```ts
type PingMessage = BaseMessage<'ping', { timestamp: string }>
type PongMessage = BaseMessage<'pong', { timestamp: string }>
type EchoRequest = BaseMessage<'echo-request', { text: string }>
type EchoResponse = BaseMessage<'echo-response', { text: string }>
```

要求：

- `echo-response.id` 必须与对应 `echo-request.id` 一致。
- echo 内容原样返回，不执行富文本或 HTML 渲染。
- 建连和等待 echo 响应的超时均为 5 秒。
- JSON 解析和协议校验由 `packages/shared` 提供可复用函数。
- 非法 JSON、未知 `type` 或缺失必填字段必须被识别为协议错误，不能导致 Background 或服务端崩溃。

### F6：Background 网络层

**优先级：P0**

- HTTP 与 WebSocket 统一由 Background Service Worker 负责。
- Background 模块初始化时尝试建立 WebSocket 一次。
- 连接状态至少包含 `connecting`、`connected`、`disconnected`、`error`。
- 连接失败后记录为 `disconnected` 或 `error`，不运行无限定时重试。
- Popup 查询连接状态或发起 echo 时，Background 调用 `ensureConnected` 再次尝试连接。
- Background 负责按消息 `id` 关联请求与响应，并在完成、失败或超时后清理等待项。
- Service Worker 被回收后不依赖内存状态；下次扩展事件唤醒时重新初始化并按需建连。

> [!info] 不使用无限定时重连的原因
> MV3 Service Worker 可能在空闲时被回收，长期定时器不是可靠的调度机制。MVP 通过用户触发的状态查询或 echo 请求恢复连接，行为更容易预测和验证。

### F7：服务端发起心跳

**优先级：P0**

- 服务端为每个活动连接每 20 秒发送一次 `ping`。
- Background 收到合法 `ping` 后立即回复同一 `id` 的 `pong`。
- 服务端发送心跳后连续 30 秒未收到对应的有效 `pong`，则主动关闭该连接。
- 心跳消息不作为 echo 结果展示在 Popup 中。
- Manifest 设置 `minimum_chrome_version: "116"`。

> [!info] Chrome 版本约束
> Chrome 116 起，扩展 Service Worker 在 30 秒活动窗口内发送或接收 WebSocket 消息会重置空闲计时器，因此 20 秒心跳可以支撑本地联调期间的连接存活。服务仍须容忍 Service Worker 被意外终止。

### F8：Popup 验证界面

**优先级：P0**

HTTP 区域：

- 提供“检查服务”按钮。
- 请求期间禁用重复提交。
- 成功时显示 `status` 和格式化后的服务端时间。
- 失败时显示归一化错误，不显示原始异常堆栈。

WebSocket 区域：

- 展示 Background 返回的连接状态。
- 提供文本输入框与 echo 按钮。
- 请求期间禁用重复提交。
- 成功时显示服务端返回的文本。
- Popup 打开或关闭不得直接创建或销毁 WebSocket。

### F9：最小权限

**优先级：P0**

- 将 Manifest 的 `host_permissions` 从 `*://*/*` 收紧为 `http://localhost:8787/*`。
- 在扩展页面 CSP 中明确允许连接 `http://localhost:8787` 和 `ws://localhost:8787`。
- Content Script 原有 `<all_urls>` 注入范围保持不变。
- 不增加允许访问任意远端地址的 Background 消息接口。

### F10：文档与测试

**优先级：P0**

- README 说明 Bun 前置要求、CLI 用法、启动命令和 Chrome 加载步骤。
- 自动测试覆盖 CLI 生成、目录保护、HTTP health、WS echo 和协议解析。
- 使用 Chrome 116+ 完成 Background 心跳与 Popup 联调的手工冒烟测试。
- 不引入浏览器自动化 E2E 框架。

## 行为约束

### 固定配置

| 项目 | 固定值 |
| --- | --- |
| HTTP Base URL | `http://localhost:8787` |
| WebSocket URL | `ws://localhost:8787/ws` |
| HTTP 超时 | 5 秒 |
| WS 建连超时 | 5 秒 |
| WS echo 超时 | 5 秒 |
| 心跳间隔 | 20 秒 |
| 心跳失效窗口 | 30 秒 |
| Chrome 最低版本 | 116 |

### CLI 失败行为

- 缺少项目名或项目名非法：打印用法并在写文件前退出，退出码非零。
- 目标路径已存在且非空：在写文件前退出，不覆盖或删除已有文件。
- 目标路径不存在或为空：允许生成。
- 未检测到 Bun：继续生成并安装 pnpm 依赖，结束时显示警告和 Bun 安装指引。
- `pnpm install` 失败：保留生成目录，返回非零退出码，并提示用户进入目录重试 `pnpm install`。

### 插件失败行为

- HTTP 无法连接：5 秒内显示“服务未启动”或等价的明确提示。
- HTTP、WS 建连或 echo 超时：5 秒内显示“连接超时”。
- WS 消息不符合共享协议：显示“消息格式错误”，记录有限的调试信息，不显示原始堆栈。
- WS 断开：状态更新为 `disconnected`，等待下一次 `ensureConnected` 触发。
- Popup 在请求完成前关闭：Background 清理超时或已完成的等待项，不向已销毁页面推送 UI 更新。

## 验收标准

### CLI 与 Monorepo

- [ ] `npm pack` 生成的 tarball 包含 CLI 可执行文件和完整内置模板。
- [ ] 从本地 tarball 调用 CLI 后，目标目录包含约定的 `apps/`、`packages/` 和根配置。
- [ ] 生成项目不包含 `packages/create-vite-crx` 源码。
- [ ] 项目名正确写入根 `package.json` 和扩展 Manifest 显示名称。
- [ ] CLI 成功生成后自动完成 `pnpm install`。
- [ ] 生成项目只有一个 `pnpm-lock.yaml`。
- [ ] 对非空目标目录执行 CLI 时退出码非零，目录内容没有变化。
- [ ] 缺少 Bun 时 CLI 仍完成文件生成，并输出可执行的安装指引。
- [ ] 模拟 `pnpm install` 失败时，生成目录仍然保留并提示重试命令。

### 构建与启动

- [ ] `pnpm dev` 能同时启动插件 watch build 和 `localhost:8787` 上的 Bun 服务。
- [ ] `pnpm dev:extension` 和 `pnpm dev:server` 可分别独立启动。
- [ ] 插件开发产物完整写入根目录 `local/`，且 Content Script 样式文件不会缺失。
- [ ] `pnpm build` 继续将可发布插件产物写入根目录 `extension/`。
- [ ] `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build` 全部通过。

### HTTP

- [ ] 请求 `GET /api/health` 返回 200、`status: "ok"` 和合法 ISO 8601 时间。
- [ ] Popup 通过 Background 完成 health 请求并显示结果，Popup 中不存在直接 `fetch`。
- [ ] 服务端未启动时，Popup 在 5 秒内显示明确失败状态。
- [ ] Background 不接受来自插件其他上下文的任意请求 URL。

### WebSocket

- [ ] Background 能连接 `ws://localhost:8787/ws` 并报告 `connected`。
- [ ] Popup 经 Background 发送 echo 后，在 5 秒内收到相同 `id` 和文本内容的响应。
- [ ] Popup 关闭后，WebSocket 不因 Popup 生命周期而被主动关闭。
- [ ] 服务端每 20 秒发送 `ping`，Background 回复相同 `id` 的 `pong`。
- [ ] 服务端 30 秒内未收到有效 `pong` 时关闭对应连接。
- [ ] 非法 JSON、未知消息类型和缺失字段均被识别，Background 与服务端保持可用。
- [ ] 服务重启后，重新打开 Popup 或再次触发 echo 可以恢复连接。

### 权限与真实浏览器冒烟

- [ ] Manifest 包含 `minimum_chrome_version: "116"`。
- [ ] Manifest 不再包含 `*://*/*` 的 `host_permissions`。
- [ ] Background 可以访问固定 HTTP/WS 地址，不能作为任意 URL 的跨域代理。
- [ ] 根目录 `local/` 可在 Chrome 116+ 中作为已解压扩展加载。
- [ ] 在真实 Chrome 中观察到 HTTP health、WS echo 和持续 `ping/pong` 均正常工作。

## 技术约束

- Node.js 保持当前仓库要求的 22+，用于 pnpm、Vite 和 CLI 工具链。
- 服务端运行时只支持 Bun；具体最低 Bun 版本在技术设计阶段结合 Hono 版本锁定。
- 服务端框架使用 Hono，并使用 Hono 的 Bun 适配能力处理 HTTP 与 WebSocket。
- 包管理器固定为 pnpm，不生成或提交 `bun.lock`。
- TypeScript 为插件、服务端、CLI 和共享协议的统一开发语言。
- 继续遵守现有 Vite 双配置、Content Script IIFE、Shadow DOM CSS 和热更新架构约束。
- 保留现有类型化 Chrome 消息机制；新增任务必须扩展 `TaskMap`，不能绕过它自建不受控消息格式。
- Background 中的网络接口使用固定 URL，不允许调用方传入完整 URL。

## 优先级

### P0：本期必须完成

- F1 Monorepo 改造。
- F2 项目生成 CLI。
- F3 统一开发命令。
- F4 HTTP 健康检查。
- F5 WebSocket Echo 与共享协议。
- F6 Background 网络层。
- F7 服务端发起心跳。
- F8 Popup 验证界面。
- F9 最小权限。
- F10 文档与测试。

### P1：后续候选

- 服务地址环境变量或 Options 配置。
- 更完整的 WebSocket 重连策略。
- 服务端生产构建与部署示例。
- 首次 npm 发布和自动发布流程。

### P2：远期候选

- Node.js 服务端适配。
- 数据库、认证和 CRUD 示例。
- HTTPS/WSS、本地证书和远端环境。
- 浏览器自动化 E2E。

## 未决事项

- `create-vite-crx` 的最终 npm 所有权与首次发布日期；当前公共 registry 查询未发现同名包，但发布时仍以 npm 返回结果为准。
- Bun 最低版本；在技术设计阶段根据锁定的 Hono 版本确定，并同步写入 README 和运行时检查。
- Popup 视觉样式；本期只要求状态和错误可辨识，不设视觉还原目标。

这些事项不阻塞 MVP 技术方案与实现拆分。

## 相关文档

- [[README]]
- [[Vite CRX Monorepo CLI Server Technical Design]]
- [Hono：Bun 入门](https://hono.dev/docs/getting-started/bun)
- [Bun：HTTP Server](https://bun.sh/docs/runtime/http/server)
- [Bun：WebSockets](https://bun.sh/docs/runtime/http/websockets)
- [Chrome Extensions：在 Service Worker 中使用 WebSocket](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets)
- [Chrome Extensions：跨源网络请求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
