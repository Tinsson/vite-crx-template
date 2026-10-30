#!/usr/bin/env bash
# 一键：拉取当前分支最新代码 → 安装依赖 → 打包 extension/ → (重)启动常驻 daemon
#
# 用法：
#   bash scripts/setup-daemon.sh [--interval <分钟>] [--skip-pull]
#   pnpm setup:daemon -- --interval 30
#
# 打包产物在仓库根目录 extension/，在 chrome://extensions 里「加载已解压的扩展程序」选它即可。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INTERVAL=""
SKIP_PULL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval)
      INTERVAL="${2:-}"
      if [[ ! "$INTERVAL" =~ ^[0-9]+$ ]]; then
        echo "✗ --interval 需要一个正整数（分钟）" >&2
        exit 1
      fi
      shift 2
      ;;
    --skip-pull) SKIP_PULL=1; shift ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "✗ 未知参数：${1}" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# bun 默认装在 ~/.bun/bin，非交互 shell 里可能不在 PATH 上
if ! command -v bun >/dev/null 2>&1 && [[ -x "$HOME/.bun/bin/bun" ]]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi
for cmd in git pnpm bun; do
  command -v "$cmd" >/dev/null 2>&1 || fail "找不到 ${cmd}，请先安装"
done

# 1. 拉取代码
if [[ $SKIP_PULL -eq 0 ]]; then
  step "拉取代码"
  BRANCH="$(git symbolic-ref --short -q HEAD || true)"
  [[ -n "$BRANCH" ]] || fail "当前处于 detached HEAD，请先切到一个分支"
  if ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    echo "分支 ${BRANCH} 没有 upstream，跳过拉取"
  else
    if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
      git status --short --untracked-files=no
      fail "工作区有未提交的改动，请先提交或 stash（也可以加 --skip-pull 跳过拉取）"
    fi
    git pull --ff-only
  fi
fi

# 2. 安装依赖
step "安装依赖"
pnpm install --frozen-lockfile

# 3. 停掉旧 daemon：避免它在打包过程中同时构建 extension/
step "停止旧的 daemon（如果在运行）"
pnpm --silent server:stop || true

# 4. 打包，把当前 commit 写进 version_name，daemon 据此判断已安装的版本
COMMIT="$(git rev-parse --short HEAD)"
step "打包 extension（commit ${COMMIT}）"
CRX_BUILD_COMMIT="$COMMIT" pnpm build

# 5. 启动 daemon
step "启动 daemon"
if [[ -n "$INTERVAL" ]]; then
  pnpm --silent server:start -- --interval "$INTERVAL"
else
  pnpm --silent server:start
fi

step "完成"
pnpm --silent server:status || true
cat <<EOF

扩展目录：${ROOT}/extension
首次使用：打开 chrome://extensions → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择上面的目录。
之后 daemon 会按间隔检查远端版本号，有新版本时自动拉取、打包并让浏览器重载扩展。
EOF
