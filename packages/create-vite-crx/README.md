# create-vite-crx

快速创建一个可直接开发的 Chrome Extension（Manifest V3）全栈项目。

生成的 pnpm monorepo 包含：

- Vite 8、Vue 3、Element Plus 和 TypeScript 扩展前端
- Background、Popup、Options、Side Panel 和 Content Script 示例
- Hono + Bun HTTP/WebSocket 服务端
- 扩展与服务端共享的类型和通信协议
- 开发构建、Content Script 热更新、测试和代码检查配置

## 环境要求

- Node.js >= 22
- pnpm >= 11
- Bun >= 1.3（运行服务端时需要）
- Chrome >= 116

## 创建项目

使用 npm：

```bash
npm create vite-crx@latest my-extension
```

也可以使用 pnpm 或 npx：

```bash
pnpm create vite-crx my-extension
npx create-vite-crx@latest my-extension
```

项目名只能包含小写字母、数字、点、下划线和连字符，并且必须以字母或数字开头。CLI 创建项目后会自动执行 `pnpm install`。

## 开始开发

```bash
cd my-extension
pnpm dev
```

打开 `chrome://extensions`，开启“开发者模式”，选择“加载已解压的扩展程序”，然后加载项目根目录下生成的 `local/` 目录。

`pnpm dev` 会同时启动：

- 扩展 watch 构建和本地热更新
- `http://localhost:8787` 上的 Bun/Hono 服务端

## 常用命令

```bash
pnpm dev              # 同时启动扩展和服务端
pnpm dev:extension    # 仅启动扩展
pnpm dev:server       # 仅启动服务端
pnpm build            # 构建生产扩展到 extension/
pnpm lint             # 运行 ESLint
pnpm typecheck        # 全工作区类型检查
pnpm test             # 全工作区测试
```

## 项目结构

```text
apps/
  extension/          Chrome Extension (MV3)
  server/             Hono + Bun HTTP/WebSocket 服务
packages/
  shared/             共享类型、协议和常量
```

更多开发说明和源码请访问 [vite-crx-template](https://github.com/Tinsson/vite-crx-template)。
