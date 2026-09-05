#!/usr/bin/env node
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn as nodeSpawn } from 'node:child_process'

export type SpawnResult = { status: number | null; error?: Error }
export type CliDeps = {
  cwd: () => string
  platform: string
  copyTemplate: (target: string) => Promise<void>
  mkdir: typeof mkdir
  readdir: typeof readdir
  readFile: typeof readFile
  rename: typeof rename
  rm: typeof rm
  writeFile: typeof writeFile
  spawn: (
    command: string,
    args: string[],
    options: { cwd: string; stdio: 'inherit' }
  ) => Promise<SpawnResult>
  checkBun: () => Promise<string | null>
  log: (message: string) => void
  error: (message: string) => void
}

const usage = 'Usage: create-vite-crx <project-name>'
const reservedNames = new Set(['node_modules', 'favicon.ico'])

export function validateProjectName(name: string | undefined): boolean {
  return (
    !!name &&
    name.length <= 214 &&
    name !== '.' &&
    name !== '..' &&
    !reservedNames.has(name) &&
    /^[a-z0-9][a-z0-9._-]*$/.test(name)
  )
}

export function templateDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), 'template')
}

async function spawned(
  command: string,
  args: string[],
  options: { cwd: string; stdio: 'inherit' }
): Promise<SpawnResult> {
  return new Promise((resolveSpawn) => {
    const child = nodeSpawn(command, args, options)
    child.once('error', (error) => resolveSpawn({ status: null, error }))
    child.once('close', (status) => resolveSpawn({ status }))
  })
}

async function copyTemplate(target: string): Promise<void> {
  const { cp } = await import('node:fs/promises')
  await cp(templateDirectory(), target, { recursive: true, force: true })
}

async function checkBun(): Promise<string | null> {
  return new Promise((resolveBun) => {
    const child = nodeSpawn(
      process.platform === 'win32' ? 'bun.cmd' : 'bun',
      ['--version'],
      { stdio: ['ignore', 'pipe', 'ignore'] }
    )
    let output = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk
    })
    child.once('error', () => resolveBun(null))
    child.once('close', (status) =>
      resolveBun(status === 0 ? output.trim() : null)
    )
  })
}

export function hasSupportedBun(version: string | null): boolean {
  if (!version) return false
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) return false
  const [major, minor] = match.slice(1).map(Number)
  return major > 1 || (major === 1 && minor >= 3)
}

const defaults: CliDeps = {
  cwd: process.cwd,
  platform: process.platform,
  copyTemplate,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
  spawn: spawned,
  checkBun,
  log: (message) => process.stdout.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`)
}

async function updateJson(
  path: string,
  name: string,
  deps: Pick<CliDeps, 'readFile' | 'writeFile'>
): Promise<void> {
  const json = JSON.parse(await deps.readFile(path, 'utf8')) as Record<
    string,
    unknown
  >
  json.name = name
  await deps.writeFile(path, `${JSON.stringify(json, null, 2)}\n`)
}

export async function runCli(
  args: string[],
  supplied: Partial<CliDeps> = {}
): Promise<number> {
  const deps = { ...defaults, ...supplied }
  if (args.length !== 1 || !validateProjectName(args[0])) {
    deps.error(usage)
    return 1
  }

  const name = args[0]
  const target = resolve(deps.cwd(), name)
  let createdByCli = false
  try {
    await deps.mkdir(target)
    createdByCli = true
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      deps.error(
        `Failed to create target directory: ${error instanceof Error ? error.message : String(error)}`
      )
      return 1
    }
    let entries: string[]
    try {
      entries = await deps.readdir(target)
    } catch {
      deps.error(`Target path already exists: ${name}`)
      return 1
    }
    if (entries.length > 0) {
      deps.error(`Target directory is not empty: ${name}`)
      return 1
    }
  }

  try {
    await deps.copyTemplate(target)
    await deps.rename(
      resolve(target, '_gitignore'),
      resolve(target, '.gitignore')
    )
    await updateJson(resolve(target, 'package.json'), name, deps)
    await updateJson(
      resolve(target, 'apps/extension/src/manifest.json'),
      name,
      deps
    )
  } catch (error) {
    deps.error(
      `Failed to create project: ${error instanceof Error ? error.message : String(error)}`
    )
    if (createdByCli) await deps.rm(target, { recursive: true, force: true })
    return 1
  }

  deps.log('[create-vite-crx] installing dependencies')
  const install = await deps.spawn(
    deps.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['install'],
    { cwd: target, stdio: 'inherit' }
  )
  if (install.status !== 0) {
    deps.error(
      'Dependency installation failed. The project files were kept; retry `pnpm install` in the directory.'
    )
    return 1
  }

  if (!hasSupportedBun(await deps.checkBun()))
    deps.error(
      'Warning: Bun 1.3.0 or newer was not found. The server package requires Bun.'
    )
  deps.log(
    `\nCreated ${name}.\n\nNext steps:\n  cd ${name}\n  pnpm dev\n\nThen open chrome://extensions, enable Developer mode, and load the unpacked local/ directory.`
  )
  return 0
}

const invokedPath = process.argv[1]
  ? await realpath(process.argv[1]).catch(() => '')
  : ''
if (invokedPath === (await realpath(fileURLToPath(import.meta.url)))) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  })
}
