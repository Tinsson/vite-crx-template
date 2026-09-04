import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(packageDir, '..', '..')
const template = resolve(packageDir, 'dist/template')
const directories = [
  'apps/extension',
  'apps/server',
  'packages/shared',
  '.husky',
  '.vscode'
]
const files = [
  'pnpm-workspace.yaml',
  'eslint.config.mjs',
  '.prettierrc',
  'README.md'
]
const excludedDirectoryNames = new Set([
  '_',
  'dist',
  'node_modules',
  'local',
  'extension',
  '.git'
])

async function copyDirectory(source, destination) {
  await cp(source, destination, {
    recursive: true,
    filter: (entry) => {
      const relative = entry.slice(source.length)
      return (
        relative === '' ||
        !relative
          .split('/')
          .some((segment) => excludedDirectoryNames.has(segment))
      )
    }
  })
}

function templatePackage(source) {
  const result = JSON.parse(JSON.stringify(source))
  for (const script of ['build:cli', 'pack:cli', 'prepack'])
    delete result.scripts?.[script]
  return result
}

await rm(template, { recursive: true, force: true })
await mkdir(template, { recursive: true })
for (const directory of directories)
  await copyDirectory(resolve(root, directory), resolve(template, directory))
for (const file of files) await cp(resolve(root, file), resolve(template, file))
await cp(resolve(root, '.gitignore'), resolve(template, '_gitignore'))

const rootPackage = JSON.parse(
  await readFile(resolve(root, 'package.json'), 'utf8')
)
await writeFile(
  resolve(template, 'package.json'),
  `${JSON.stringify(templatePackage(rootPackage), null, 2)}\n`
)
