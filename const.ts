export const bgUpdatePort = 8801

export const __DEV__ = process.env.CRX_ENV === 'development'

export const outputDir = __DEV__ ? 'local' : 'extension'
