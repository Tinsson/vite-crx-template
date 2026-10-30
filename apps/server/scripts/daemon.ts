#!/usr/bin/env bun
/**
 * 常驻服务管理：
 *   bun scripts/daemon.ts start [--interval <分钟>]
 *   bun scripts/daemon.ts stop | restart | status | logs
 *
 * pid、日志、配置都放在 ~/.vite-crx（可用 VITE_CRX_HOME 覆盖）。
 */
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { DAEMON_HTTP_BASE_URL, DAEMON_PORT } from '@vite-crx/shared'

const home = process.env.VITE_CRX_HOME ?? join(homedir(), '.vite-crx')
const pidFile = join(home, 'server.pid')
const logFile = join(home, 'server.log')
const serverRoot = resolve(import.meta.dir, '..')

type Health = { status: string; mode?: string } | null

async function health(): Promise<Health> {
  try {
    const res = await fetch(`${DAEMON_HTTP_BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(1500)
    })
    return res.ok
      ? ((await res.json()) as Health)
      : { status: `HTTP ${res.status}` }
  } catch {
    return null
  }
}

function readPid(): number | null {
  if (!existsSync(pidFile)) return null
  const pid = Number.parseInt(readFileSync(pidFile, 'utf-8'), 10)
  if (!Number.isFinite(pid)) return null
  try {
    process.kill(pid, 0)
    return pid
  } catch {
    return null
  }
}

function parseInterval(args: string[]): string | undefined {
  const i = args.indexOf('--interval')
  if (i === -1) return undefined
  const value = Number(args[i + 1])
  if (!Number.isFinite(value) || value <= 0) {
    console.error('--interval 需要一个正数（分钟）')
    process.exit(1)
  }
  return String(value)
}

async function start(args: string[]): Promise<void> {
  const existing = await health()
  if (existing?.mode === 'daemon') {
    console.log(
      `daemon 已在运行（pid ${readPid() ?? '未知'}，端口 ${DAEMON_PORT}）`
    )
    return
  }
  if (existing) {
    console.error(`端口 ${DAEMON_PORT} 已被其他进程占用，无法启动 daemon`)
    process.exit(1)
  }

  mkdirSync(home, { recursive: true })
  const log = openSync(logFile, 'a')
  const interval = parseInterval(args)
  const child = spawn(process.execPath, ['src/index.ts'], {
    cwd: serverRoot,
    detached: true,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      VITE_CRX_MODE: 'daemon',
      ...(interval ? { VITE_CRX_INTERVAL: interval } : {})
    }
  })
  child.unref()
  writeFileSync(pidFile, String(child.pid))

  for (let i = 0; i < 25; i++) {
    await Bun.sleep(200)
    if ((await health())?.mode === 'daemon') {
      console.log(`daemon 已启动：${DAEMON_HTTP_BASE_URL}（pid ${child.pid}）`)
      console.log(`日志：${logFile}`)
      return
    }
  }
  console.error(`daemon 启动超时，请查看日志：${logFile}`)
  process.exit(1)
}

async function stop(): Promise<void> {
  const pid = readPid()
  if (pid === null) {
    rmSync(pidFile, { force: true })
    console.log('daemon 未在运行')
    return
  }
  process.kill(pid, 'SIGTERM')
  for (let i = 0; i < 25; i++) {
    await Bun.sleep(200)
    if (readPid() === null) break
  }
  if (readPid() !== null) process.kill(pid, 'SIGKILL')
  rmSync(pidFile, { force: true })
  console.log(`daemon 已停止（pid ${pid}）`)
}

async function status(): Promise<void> {
  const pid = readPid()
  const h = await health()
  if (h?.mode !== 'daemon') {
    console.log(pid ? `进程 ${pid} 存在但没有响应` : 'daemon 未在运行')
    process.exitCode = 1
    return
  }
  console.log(`daemon 运行中：${DAEMON_HTTP_BASE_URL}（pid ${pid ?? '未知'}）`)
  try {
    const res = await fetch(`${DAEMON_HTTP_BASE_URL}/api/update/status`)
    const s = (await res.json()) as any
    console.log(`  分支：${s.branch ?? '-'}`)
    console.log(
      `  已安装：${s.installedVersion ?? '-'}（${s.installedCommit ?? '-'}）`
    )
    console.log(`  远端：${s.remoteVersion ?? '-'}（${s.remoteCommit ?? '-'}）`)
    console.log(
      `  自动更新：${s.config.autoUpdate ? '开' : '关'}，间隔 ${s.config.checkIntervalMinutes} 分钟`
    )
    console.log(
      `  上次检查：${s.lastCheckAt ?? '-'}，下次检查：${s.nextCheckAt ?? '-'}`
    )
    if (s.blockedBy) console.log(`  被阻止：${s.blockedBy}`)
    if (s.job)
      console.log(
        `  最近任务：${s.job.state} ${s.job.step} ${s.job.message ?? ''}`
      )
  } catch {
    // 状态接口不可用时只显示运行状态
  }
}

function logs(): void {
  if (!existsSync(logFile)) {
    console.log('还没有日志')
    return
  }
  const lines = readFileSync(logFile, 'utf-8').trimEnd().split('\n')
  console.log(lines.slice(-100).join('\n'))
}

const [command, ...rest] = process.argv.slice(2)
switch (command) {
  case 'start':
    await start(rest)
    break
  case 'stop':
    await stop()
    break
  case 'restart':
    await stop()
    await start(rest)
    break
  case 'status':
    await status()
    break
  case 'logs':
    logs()
    break
  default:
    console.log(
      '用法：bun scripts/daemon.ts <start [--interval 分钟]|stop|restart|status|logs>'
    )
    process.exitCode = command ? 1 : 0
}
