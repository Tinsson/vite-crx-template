import { describe, expect, it } from 'vitest'
import { templatePackage } from '../scripts/template-package.mjs'

describe('templatePackage', () => {
  it('removes repository release tooling from generated projects', () => {
    const result = templatePackage({
      scripts: {
        dev: 'pnpm dev',
        'build:cli': 'pnpm build',
        changeset: 'changeset',
        'version-packages': 'changeset version',
        release: 'changeset publish'
      },
      devDependencies: {
        '@changesets/cli': '^3.0.1',
        vite: '^8.2.0'
      }
    })

    expect(result).toEqual({
      scripts: { dev: 'pnpm dev' },
      devDependencies: { vite: '^8.2.0' }
    })
  })
})
