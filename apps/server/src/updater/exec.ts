export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

export interface RunOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  timeoutMs?: number
}

/** 执行外部命令；测试里替换成假的实现 */
export type Runner = (cmd: string[], options?: RunOptions) => Promise<RunResult>

export class CommandError extends Error {
  constructor(
    readonly cmd: string[],
    readonly result: RunResult
  ) {
    super(
      `${cmd.join(' ')} 退出码 ${result.code}${
        result.stderr.trim()
          ? `：${lastLines(result.stderr, 3).join(' / ')}`
          : ''
      }`
    )
    this.name = 'CommandError'
  }
}

export const bunRunner: Runner = async (cmd, options = {}) => {
  const proc = Bun.spawn(cmd, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  let timedOut = false
  const timer = options.timeoutMs
    ? setTimeout(() => {
        timedOut = true
        proc.kill()
      }, options.timeoutMs)
    : null
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  if (timer) clearTimeout(timer)
  if (timedOut) {
    return {
      code: code || 124,
      stdout,
      stderr: `${stderr}\n命令超时（${options.timeoutMs}ms）`
    }
  }
  return { code, stdout, stderr }
}

/** 执行命令，非 0 退出码抛 CommandError */
export async function runOrThrow(
  run: Runner,
  cmd: string[],
  options?: RunOptions
): Promise<RunResult> {
  const result = await run(cmd, options)
  if (result.code !== 0) throw new CommandError(cmd, result)
  return result
}

export function lastLines(text: string, count: number): string[] {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-count)
}
