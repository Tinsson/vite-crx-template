import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveOutputDir } from './outputDir.js'

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

await fs.remove(resolveOutputDir(workspaceRoot))
