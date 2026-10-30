import path from 'path'
import process from 'process'

/**
 * 扩展产物目录：默认 dev → 仓库根 local/，prod → 仓库根 extension/。
 * 设置 CRX_OUT_DIR 时改为输出到该目录（daemon 先构建到 staging 目录再原子替换）。
 * 需与 const.ts 的 outputDir 保持一致。
 */
export function resolveOutputDir(workspaceRoot, env = process.env) {
  if (env.CRX_OUT_DIR) return path.resolve(workspaceRoot, env.CRX_OUT_DIR)
  return path.resolve(
    workspaceRoot,
    env.CRX_ENV === 'development' ? 'local' : 'extension'
  )
}
