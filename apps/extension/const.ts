import { resolve } from 'node:path'

export const extensionRoot = import.meta.dirname
export const workspaceRoot = resolve(extensionRoot, '../..')

export const bgUpdatePort = 8801

export const __DEV__ = process.env.CRX_ENV === 'development'

export const outputDir = resolve(workspaceRoot, __DEV__ ? 'local' : 'extension')
