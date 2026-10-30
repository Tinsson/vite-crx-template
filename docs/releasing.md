# 发布 create-vite-crx

仓库通过 `.github/workflows/release.yml` 自动发布 npm 脚手架包。

## 首次配置

1. 将工作流合并到 `master`。
2. 在 GitHub 仓库的 **Settings → Actions → General → Workflow permissions** 中启用 **Allow GitHub Actions to create and approve pull requests**。工作流已按任务声明所需权限。
3. 在 npm 的 `create-vite-crx` 包设置中添加 GitHub Actions Trusted Publisher：

   | 字段                 | 值                            |
   | -------------------- | ----------------------------- |
   | Organization or user | `Tinsson`                     |
   | Repository           | `vite-crx-template`           |
   | Workflow filename    | `release.yml`                 |
   | Environment name     | 留空                          |
   | Allowed actions      | 允许直接发布（`npm publish`） |

工作流通过 OIDC 认证，无需配置 `NPM_TOKEN`。GitHub 的版本 PR、标签和 Release 使用自动提供的 `GITHUB_TOKEN`。只有发布任务具有 `id-token: write` 权限。

参考：[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) 和 [Changesets 自动化说明](https://changesets.dev/guide/automating)。

## 日常发布

1. 对需要发版的变更运行 `pnpm changeset`，选择 `create-vite-crx`、版本类型并填写变更说明，将生成的 `.changeset/*.md` 随代码提交。
2. 合并到 `master` 后，工作流自动创建或更新「chore: 发布新版本」PR，包含版本号和 CHANGELOG。
3. 审核并合并版本 PR。工作流依次运行 lint、全工作区类型检查、单元测试、扩展生产构建和 CLI 构建，全部通过后发布 npm 包，并创建 Git 标签和 GitHub Release。

无需手动运行 `version-packages`、修改版本号或推送标签。同一分支的发布任务串行执行，不会取消正在进行的发布。

当前 `.changeset/bright-readme.md` 是待处理的 patch changeset；首次运行会将其纳入版本 PR。其他 workspace 包均为私有包，不会发布。

## 重试与范围

失败时先查看 Actions 日志。认证失败应核对 npm Trusted Publisher 的仓库、文件名和直接发布权限；创建 PR 失败应检查 GitHub 的 Actions PR 开关。

可在 Actions 的 **Release → Run workflow** 中选择 `master` 手动重试。其他分支或 fork 上会跳过发布。没有待处理 changeset 且包版本已在 npm 发布时，工作流不再发布。

此流程发布 `create-vite-crx` npm 包及对应 GitHub Release；扩展 ZIP 附件和 Chrome Web Store 发布需要另行配置。
