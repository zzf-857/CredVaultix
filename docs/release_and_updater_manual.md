# CredVaultix 提交、发布与自动更新手册

## 日常提交

一次提交只表达一个目的，并使用 Conventional Commit：

```text
feat(accounts): 完善自定义字段编辑
fix(backup): 修复数据库导入后的连接刷新
test(otp): 覆盖非默认 TOTP 参数
docs(readme): 更新功能和安全说明
chore(release): 发布 v1.0.4
```

提交前执行：

```powershell
npm ci
npm run verify
```

不要使用 `git add .`。先用 `git status --short` 检查，再明确添加本次修改的文件，避免把数据库、备份、EXE 或调试输出提交到仓库。

## Pull Request / main 流程

推送到 `main` 或创建 Pull Request 后，`.github/workflows/main.yml` 会在 Windows 环境执行：

1. `npm ci`
2. `npm audit --audit-level=high`
3. 单元与组件测试
4. TypeScript 检查
5. Vite 生产构建

任何一步失败都不应继续创建版本标签。

### 建议的 GitHub 仓库保护

在 GitHub 的 `Settings → Branches` 中为 `main` 配置保护规则：

- 禁止 force push 和删除分支。
- 日常修改通过 Pull Request 合并，至少要求 CI 的 `Test, typecheck and build` 成功。
- 合并前要求所有审查对话已解决；个人仓库可以不强制第二位审批人。
- 不直接在失败的 main 提交上创建版本标签；Release Workflow 虽会再次验证，但不能代替 main 的持续集成结果。
- 如仓库支持 tag protection / ruleset，为 `v*` 限制删除和重写，公开标签创建错误时发布新版本，不强推旧标签。

## 正式发布

假设准备发布 `1.0.4`：

1. 更新 `package.json` 和 `package-lock.json` 的版本。
2. 把 `CHANGELOG.md` 的 `Unreleased` 内容整理到 `## [1.0.4] - YYYY-MM-DD`。
3. 执行完整检查：

```powershell
npm run release:check -- --tag v1.0.4 --allow-dirty
npm run verify
npm run electron:build -- --publish never
npm run release:assets
```

4. 分别提交功能代码、测试和文档，最后创建发布提交：

```powershell
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): 发布 v1.0.4"
git push origin main
```

5. 确认 main 的 CI 成功后，创建带完整说明的 annotated tag：

```powershell
node scripts/extract-release-notes.mjs 1.0.4 release-notes.md
git tag -a v1.0.4 -F release-notes.md
git push origin v1.0.4
```

标签推送会触发 `.github/workflows/release.yml`。工作流会再次校验标签与版本、审计完整依赖树、运行测试和类型检查、构建 Windows 安装包，并核对 `latest.yml` 中的版本、路径、文件大小和 SHA-512 后发布：

- `CredVaultix-Setup-X.Y.Z.exe`
- `CredVaultix-Setup-X.Y.Z.exe.blockmap`
- `latest.yml`

Release 正文来自对应的 CHANGELOG 章节，不再产生空白 Release。

## 客户端更新

安装版启动五秒后检查 GitHub Releases，也可以在设置中手动检查。更新流程必须同时满足：

- 线上版本高于当前版本。
- Release 包含安装包、blockmap 和 `latest.yml`。
- `latest.yml` 的文件名、大小和 SHA-512 与安装包一致。

下载完成后，客户端会完成 WAL checkpoint、创建更新前数据库备份并验证 SQLite 完整性与受保护表记录数。随后通过 `electron-updater` 的标准 `quitAndInstall()` 流程请求可见 NSIS 安装向导，并在更新退出事件中关闭数据库。安装未完成时，下次启动会保留失败诊断并允许重新检查；便携版、开发环境和手工复制的非安装目录不会自动覆盖。

更新日志位于用户数据目录的 `logs/updater.log`，设置页可以直接打开日志目录。日志仅记录版本、程序路径、安装阶段和错误，不记录账号、密码、2FA 或服务字段内容。

`v1.1.0` 及更早版本的旧更新器可能在安装器真正启动前退出。此类客户端无法通过远端代码修复自身，需要从 GitHub Releases 手动运行一次最新安装包完成升级引导。

## 失败处理

- `npm ci` 失败：首先检查 `package.json` 与 `package-lock.json` 是否同步。
- 标签校验失败：不要修改或强推公开标签；删除尚未推送的本地标签，修正版本后重新创建。
- Release 构建失败：修复后在 GitHub Actions 中重新运行同一工作流，不创建第二个相同版本标签。
- Release 已创建但资产不完整：不要让客户端使用该版本；补齐并核对三个更新资产。
- 应用退出但安装向导未出现：重新打开应用，在设置中查看更新日志并重试；旧版本请直接从 Releases 手动运行最新安装包。
- `gh` 未认证：执行 `gh auth login` 或 `gh auth refresh -h github.com`，再处理 Release 管理操作。
