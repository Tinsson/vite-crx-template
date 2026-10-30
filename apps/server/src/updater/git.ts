import { runOrThrow, type Runner } from './exec.ts'

const FETCH_TIMEOUT_MS = 60_000

/** 只封装 updater 需要的几个 git 操作，工作目录固定为仓库根目录 */
export class Git {
  constructor(
    private readonly run: Runner,
    private readonly cwd: string
  ) {}

  private async out(args: string[], timeoutMs = 15_000): Promise<string> {
    const result = await runOrThrow(this.run, ['git', ...args], {
      cwd: this.cwd,
      timeoutMs
    })
    return result.stdout.trim()
  }

  private async tryOut(args: string[]): Promise<string | null> {
    const result = await this.run(['git', ...args], {
      cwd: this.cwd,
      timeoutMs: 15_000
    })
    return result.code === 0 ? result.stdout.trim() : null
  }

  /** 当前分支名；detached HEAD 时返回 null */
  currentBranch(): Promise<string | null> {
    return this.tryOut(['symbolic-ref', '--short', '-q', 'HEAD'])
  }

  /** 当前分支的 upstream（如 origin/master）；没有时返回 null */
  upstream(): Promise<string | null> {
    return this.tryOut([
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}'
    ])
  }

  async fetch(branch: string): Promise<void> {
    const remote =
      (await this.tryOut(['config', '--get', `branch.${branch}.remote`])) ||
      'origin'
    await this.out(['fetch', '--quiet', remote], FETCH_TIMEOUT_MS)
  }

  head(ref = 'HEAD'): Promise<string> {
    return this.out(['rev-parse', ref])
  }

  /** 相对 upstream 领先 / 落后的提交数 */
  async aheadBehind(): Promise<{ ahead: number; behind: number }> {
    const [ahead, behind] = (
      await this.out(['rev-list', '--left-right', '--count', 'HEAD...@{u}'])
    )
      .split(/\s+/)
      .map((n) => Number.parseInt(n, 10) || 0)
    return { ahead, behind }
  }

  /** 已跟踪文件中未提交的改动（未跟踪文件不算，pull 冲突时 git 自己会拒绝） */
  async dirtyFiles(): Promise<string[]> {
    // 不能 trim：porcelain 每行前两位是状态码，首行可能以空格开头
    const { stdout } = await runOrThrow(
      this.run,
      ['git', 'status', '--porcelain', '--untracked-files=no'],
      { cwd: this.cwd, timeoutMs: 15_000 }
    )
    return stdout
      .split('\n')
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
  }

  showFile(ref: string, path: string): Promise<string | null> {
    return this.tryOut(['show', `${ref}:${path}`])
  }

  /** 已 fetch 过，直接 fast-forward 到 upstream，等价于 pull --ff-only */
  async fastForward(): Promise<void> {
    await this.out(['merge', '--ff-only', '--quiet', '@{u}'])
  }

  async changedFiles(from: string, to: string): Promise<string[]> {
    if (from === to) return []
    const out = await this.out(['diff', '--name-only', from, to])
    return out.split('\n').filter(Boolean)
  }
}
