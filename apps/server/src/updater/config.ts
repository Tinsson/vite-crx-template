import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  DEFAULT_UPDATE_CONFIG,
  normalizeUpdateConfig,
  type UpdateConfig
} from '@vite-crx/shared'

/** 读取 ~/.vite-crx/config.json；文件不存在或内容非法时用默认值 */
export async function loadConfig(file: string): Promise<UpdateConfig> {
  try {
    const raw = await readFile(file, 'utf-8')
    return normalizeUpdateConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_UPDATE_CONFIG }
  }
}

export async function saveConfig(
  file: string,
  config: UpdateConfig
): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}
