import { resolve } from 'node:path'

export const extensionRoot = import.meta.dirname
export const workspaceRoot = resolve(extensionRoot, '../..')

export const bgUpdatePort = 8801

export const __DEV__ = process.env.CRX_ENV === 'development'

// CRX_OUT_DIR 可覆盖输出目录（daemon 先构建到 staging 再替换）；与 scripts/outputDir.js 保持一致
export const outputDir = process.env.CRX_OUT_DIR
  ? resolve(workspaceRoot, process.env.CRX_OUT_DIR)
  : resolve(workspaceRoot, __DEV__ ? 'local' : 'extension')
