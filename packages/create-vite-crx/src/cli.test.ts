import { describe, expect, it, vi } from 'vitest'
import {
  hasSupportedBun,
  runCli,
  validateProjectName,
  type CliDeps
} from './cli.js'

const valid = ['project', 'a.b_c-9', '0']
const invalid = [
  '',
  '.',
  '..',
  'Node',
  'a/b',
  'a\\b',
  '-first',
  '_first',
  'node_modules',
  'favicon.ico',
  'a'.repeat(215)
]

describe('validateProjectName', () => {
  it('accepts the constrained MVP names', () =>
    valid.forEach((name) => expect(validateProjectName(name)).toBe(true)))
  it('rejects unsafe names', () =>
    invalid.forEach((name) => expect(validateProjectName(name)).toBe(false)))
})

describe('hasSupportedBun', () => {
  it('requires Bun 1.3.0 or newer', () => {
    expect(hasSupportedBun('1.3.0')).toBe(true)
    expect(hasSupportedBun('1.2.99')).toBe(false)
    expect(hasSupportedBun(null)).toBe(false)
  })
})

function deps(overrides: Partial<CliDeps> = {}): Partial<CliDeps> {
  return {
    cwd: () => '/tmp',
    platform: 'linux',
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    copyTemplate: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    spawn: vi.fn().mockResolvedValue({ status: 0 }),
    checkBun: vi.fn().mockResolvedValue('1.3.0'),
    log: vi.fn(),
    error: vi.fn(),
    ...overrides
  }
}

describe('runCli', () => {
  it('prints usage without touching disk for invalid arguments', async () => {
    const d = deps()
    expect(await runCli([], d)).toBe(1)
    expect(d.mkdir).not.toHaveBeenCalled()
    expect(d.error).toHaveBeenCalledWith(
      'Usage: create-vite-crx <project-name>'
    )
  })

  it('refuses a non-empty existing directory before copying', async () => {
    const d = deps({
      mkdir: vi.fn().mockRejectedValue({ code: 'EEXIST' }),
      readdir: vi.fn().mockResolvedValue(['keep'])
    })
    expect(await runCli(['safe'], d)).toBe(1)
    expect(d.copyTemplate).not.toHaveBeenCalled()
    expect(d.rm).not.toHaveBeenCalled()
  })

  it('refuses an existing non-directory before copying', async () => {
    const d = deps({
      mkdir: vi.fn().mockRejectedValue({ code: 'EEXIST' }),
      readdir: vi.fn().mockRejectedValue(new Error('not a directory'))
    })
    expect(await runCli(['safe'], d)).toBe(1)
    expect(d.copyTemplate).not.toHaveBeenCalled()
  })

  it('reports a target directory creation failure', async () => {
    const d = deps({
      mkdir: vi.fn().mockRejectedValue(new Error('permission denied'))
    })
    expect(await runCli(['safe'], d)).toBe(1)
    expect(d.copyTemplate).not.toHaveBeenCalled()
    expect(d.error).toHaveBeenCalledWith(
      'Failed to create target directory: permission denied'
    )
  })

  it('cleans only a newly-created target when copying fails', async () => {
    const d = deps({
      copyTemplate: vi.fn().mockRejectedValue(new Error('copy failed'))
    })
    expect(await runCli(['safe'], d)).toBe(1)
    expect(d.rm).toHaveBeenCalledWith('/tmp/safe', {
      recursive: true,
      force: true
    })
  })

  it('keeps a pre-existing empty target when copying fails', async () => {
    const d = deps({
      mkdir: vi.fn().mockRejectedValue({ code: 'EEXIST' }),
      copyTemplate: vi.fn().mockRejectedValue(new Error('copy failed'))
    })
    expect(await runCli(['safe'], d)).toBe(1)
    expect(d.rm).not.toHaveBeenCalled()
  })

  it('transforms JSON, restores gitignore, and maps install failure to one', async () => {
    const d = deps({ spawn: vi.fn().mockResolvedValue({ status: 1 }) })
    expect(await runCli(['safe'], d)).toBe(1)
    expect(d.rename).toHaveBeenCalledWith(
      '/tmp/safe/_gitignore',
      '/tmp/safe/.gitignore'
    )
    expect(d.writeFile).toHaveBeenCalledTimes(2)
    expect(d.spawn).toHaveBeenCalledWith('pnpm', ['install'], {
      cwd: '/tmp/safe',
      stdio: 'inherit'
    })
  })

  it('uses pnpm.cmd on Windows and tolerates a missing Bun', async () => {
    const d = deps({
      platform: 'win32',
      checkBun: vi.fn().mockResolvedValue(null)
    })
    expect(await runCli(['safe'], d)).toBe(0)
    expect(d.spawn).toHaveBeenNthCalledWith(1, 'pnpm.cmd', ['install'], {
      cwd: '/tmp/safe',
      stdio: 'inherit'
    })
    expect(d.error).toHaveBeenCalledWith(expect.stringContaining('Bun 1.3.0'))
  })
})
