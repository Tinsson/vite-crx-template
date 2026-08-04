# vite-crx-template

简单好用的chrome插件开发模板

## Features

- 🚀 支持V3版本的manifest
- 🖥 支持background,contentScript,popup的热更新，contentScript支持按窗口重注入
- 📦 vite 8 + vue3 + elementplus + typescript
- 🔔 统一的类型化消息通信（contentScript ↔ background ↔ popup）

## 开发

拉取代码后

```bash
pnpm i
pnpm dev
```
开发环境，调试用的结果代码放在根目录 `local` 文件夹下

## 发布打包

拉取代码后

```bash
pnpm build
```

生成环境，代码放在根目录 `extension` 文件夹下

