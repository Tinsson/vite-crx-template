#!/usr/bin/env bash
# 一键：空目录自动克隆 / 已有仓库拉取 → 安装依赖 → 打包 extension/ → (重)启动常驻 daemon
#
# 用法：
#   bash scripts/setup-daemon.sh [--repo <仓库地址>] [--interval <分钟>] [--skip-pull]
#   pnpm setup:daemon -- --interval 30
#   在空目录中执行（自动安装缺失的 Node.js、pnpm、bun）：
#   curl -fsSL https://raw.githubusercontent.com/Tinsson/vite-crx-template/master/scripts/setup-daemon.sh | bash -s -- --interval 30
#
# 打包产物在仓库根目录 extension/，在 chrome://extensions 里「加载已解压的扩展程序」选它即可。
set -euo pipefail

INTERVAL=""
SKIP_PULL=0
REPO_URL="${SETUP_DAEMON_REPO:-https://github.com/Tinsson/vite-crx-template.git}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      [[ -n "${2:-}" && "$2" != -* ]] || { echo "✗ --repo 需要一个仓库地址" >&2; exit 1; }
      REPO_URL="$2"
      shift 2
      ;;
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
      cat <<'EOF'
用法：bash scripts/setup-daemon.sh [--repo <仓库地址>] [--interval <分钟>] [--skip-pull]
      pnpm setup:daemon -- --interval 30
空目录安装：
  curl -fsSL https://raw.githubusercontent.com/Tinsson/vite-crx-template/master/scripts/setup-daemon.sh | bash -s -- --interval 30

空目录会自动克隆仓库到当前目录；已有仓库会拉取当前分支。
--skip-pull  跳过已有仓库的拉取（空目录仍会克隆）
--repo <地址>  设置首次克隆的仓库地址，也可通过 SETUP_DAEMON_REPO 环境变量设置。
               优先级：--repo > SETUP_DAEMON_REPO > https://github.com/Tinsson/vite-crx-template.git
               已有仓库仍使用其当前分支的 upstream。
产物目录：仓库根目录 extension/
需要预先安装：git；自动安装工具还需要 curl，安装 Bun 需要 unzip。
Node.js 缺失或低于 22 时，通过 nvm 安装 Node.js 22（用户目录，无需 sudo）。
已有 Node.js >= 22 时直接复用。nvm 使用 NVM_DIR（默认 ~/.nvm），不会自动修改 shell 配置。
缺少 Bun 时使用官方安装脚本（需要 curl、unzip）。
缺少 pnpm 时优先使用 Corepack，否则使用 npm，安装项目 packageManager 指定的版本。
pnpm 安装到 ~/.local/bin，当前脚本会自动加入 PATH；后续手动使用时需将其加入 PATH。
EOF
      exit 0
      ;;
    *) echo "✗ 未知参数：${1}" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# 先检查基础工具，避免在无效环境中开始安装。
command -v git >/dev/null 2>&1 || fail "找不到 git，请先安装"

# 远程管道执行时没有脚本路径；先检查调用者的当前目录（包括隐藏文件）。
shopt -s nullglob dotglob
ENTRIES=(*)
shopt -u nullglob dotglob
CLONED=0
if [[ ${#ENTRIES[@]} -eq 0 ]]; then
  step "克隆仓库到当前目录"
  git clone -- "$REPO_URL" .
  ROOT="$PWD"
  CLONED=1
else
  ROOT="$PWD"
  if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
    ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  fi
  [[ -d "$ROOT/.git" || -f "$ROOT/.git" ]] && [[ -f "$ROOT/pnpm-workspace.yaml" && -f "$ROOT/scripts/setup-daemon.sh" ]] \
    || fail "当前目录非空且未找到项目仓库，请在空目录或已有项目仓库中执行"
fi
cd "$ROOT"

# 1. 拉取代码
if [[ $SKIP_PULL -eq 0 && $CLONED -eq 0 ]]; then
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

# 先同步仓库，再按项目声明安装工具，兼容自定义仓库。
node_ready() {
  command -v node >/dev/null 2>&1 \
    && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'
}
if ! node_ready; then
  command -v curl >/dev/null 2>&1 || fail "自动安装 Node.js 需要 curl，请先安装"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    step "安装 nvm"
    NVM_INSTALLER="$(curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh)"
    PROFILE=/dev/null bash -c "$NVM_INSTALLER" </dev/null
  fi
  [[ -s "$NVM_DIR/nvm.sh" ]] || fail "nvm 安装后不可用，请检查安装输出"
  # nvm 在部分版本中引用未定义变量，加载和调用时暂时关闭 nounset。
  set +u
  source "$NVM_DIR/nvm.sh" --no-use || fail "加载 nvm 失败"
  if ! nvm use 22 >/dev/null 2>&1; then
    step "安装 Node.js 22"
    nvm install 22 </dev/null || fail "Node.js 22 安装失败，请检查安装输出"
  fi
  set -u
  node_ready || fail "Node.js 安装后不可用或版本低于 22，请检查安装输出"
fi

if ! command -v pnpm >/dev/null 2>&1 && [[ -x "$HOME/.local/bin/pnpm" ]]; then
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v pnpm >/dev/null 2>&1; then
  PNPM_SPEC="$(node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).packageManager || ""')"
  [[ "$PNPM_SPEC" == pnpm@* ]] || fail "package.json 需要通过 packageManager 指定 pnpm 版本"
  step "安装 ${PNPM_SPEC}"
  mkdir -p "$HOME/.local/bin"
  if command -v corepack >/dev/null 2>&1; then
    corepack install --global "$PNPM_SPEC"
    corepack enable --install-directory "$HOME/.local/bin" pnpm
  elif command -v npm >/dev/null 2>&1; then
    npm install --global --prefix "$HOME/.local" "${PNPM_SPEC%%+*}"
  else
    fail "安装 pnpm 需要 Corepack 或 npm，请安装其中一个后重试"
  fi
  export PATH="$HOME/.local/bin:$PATH"
  command -v pnpm >/dev/null 2>&1 || fail "pnpm 安装后不可用，请检查安装输出"
fi

BUN_BIN="${BUN_INSTALL:-$HOME/.bun}/bin"
if ! command -v bun >/dev/null 2>&1 && [[ -x "$BUN_BIN/bun" ]]; then
  export PATH="$BUN_BIN:$PATH"
fi
if ! command -v bun >/dev/null 2>&1; then
  for cmd in curl unzip; do
    command -v "$cmd" >/dev/null 2>&1 || fail "自动安装 Bun 需要 ${cmd}，请先安装"
  done
  step "安装 Bun"
  BUN_INSTALLER="$(curl -fsSL https://bun.sh/install)"
  bash -c "$BUN_INSTALLER" </dev/null
  export PATH="$BUN_BIN:$PATH"
  command -v bun >/dev/null 2>&1 || fail "Bun 安装后不可用，请检查安装输出"
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
