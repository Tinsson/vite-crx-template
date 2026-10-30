import type { UpdateBlockReason, UpdateStep } from '@vite-crx/shared'

export const UPDATE_STEPS: { step: UpdateStep; label: string }[] = [
  { step: 'fetch', label: '检查' },
  { step: 'pull', label: '拉取' },
  { step: 'install', label: '安装' },
  { step: 'build', label: '构建' },
  { step: 'verify', label: '校验' },
  { step: 'swap', label: '替换' }
]

export const BLOCK_REASON_LABELS: Record<UpdateBlockReason, string> = {
  dirty: '工作区有未提交的改动，已暂停自动更新',
  diverged: '本地分支和远端已分叉，需要手动处理',
  'no-upstream': '当前分支没有 upstream，无法检查远端',
  detached: '当前处于 detached HEAD，无法检查远端'
}

export function formatTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
