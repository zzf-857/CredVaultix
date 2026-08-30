# CredVaultix 开发规范

## 技术栈与目录边界

- 本项目是 Windows 桌面应用，开发环境要求 Node.js 22.12 或更高版本；核心技术为 Electron、React、TypeScript、Material UI、Zustand、Vite、Vitest 和 SQLite。
- `src/` 负责渲染进程与界面，`electron/` 负责主进程、SQLite、加密、备份和 IPC，`shared/` 放置主进程与渲染进程共用的纯逻辑，`scripts/` 放置发布校验工具。
- 渲染进程不得直接使用 Electron、Node.js 或数据库能力；特权操作统一通过 `window.electronAPI`。新增或修改 IPC 时，必须同步维护主进程处理器、`electron/preload.ts` 和 `src/types.ts` 中的 `ElectronAPI` 契约。
- 跨进程共用的解析、规范化或类型逻辑优先放入 `shared/`；已有渲染端兼容入口保持为薄重导出，不复制实现。

## 代码与界面

- 保持 TypeScript 严格类型检查，并遵循相邻文件的既有风格：通常使用 2 空格缩进、单引号和无分号；不要进行与任务无关的大范围格式化。
- 当前仓库没有 ESLint、Prettier、Biome 或 `lint` 脚本，不要声称执行了不存在的检查。
- React 界面继续使用函数组件、MUI、`sx`、主题 token 和已有的公共组件；避免重复实现 `PageHeader`、`EmptyState`、`SectionLabel`、`ResizableSidebar` 等通用模式。
- 界面更新必须同时检查深浅主题、紧凑桌面布局、窗口尺寸变化、键盘焦点和 `prefers-reduced-motion`。
- 纯视觉调整不得顺带改变数据库结构、IPC 契约、导入导出行为或产品范围。

## 数据与安全

- 用户数据优先于功能变更。数据库迁移、导入、替换或静态加密迁移必须先创建并验证安全备份；失败时停止后续写入，并在可行时恢复原数据库。
- 多表或批量写入使用事务，并验证完整性、外键、核心表记录数及必要的记录身份，避免部分提交。
- 敏感账号字段、2FA 密钥、二维码原图和敏感服务字段必须在写入 SQLite 前加密；日志、测试夹具、截图和文档不得包含真实凭据。
- 保持 Electron 的 `contextIsolation`、渲染沙箱、禁用 Node 集成、CSP、导航拦截和默认拒绝权限请求等安全边界。
- 账号和服务默认软删除；彻底删除只作用于回收站记录，并保留既有的关联 2FA 孤立提醒语义。
- 保持离线优先，不引入遥测、统计脚本、远程字体或未经产品范围确认的云同步。

## 测试与验证

- 行为变更和缺陷修复应添加或更新同目录的 `*.test.ts` 或 `*.test.mjs` 回归测试；数据库测试优先使用内存数据库以及事务/回滚断言。
- Vitest 当前只收集 `src/**/*.test.ts`、`electron/**/*.test.ts` 和 `scripts/**/*.test.mjs`；在其他目录新增测试时必须同步更新测试配置。
- 交付前运行 `npm run verify`，它依次覆盖测试、渲染进程与 Electron 类型检查以及生产前端构建。
- 涉及依赖或发布时还应运行 `npm audit --audit-level=high`；涉及安装包或更新器时运行本地打包及 `npm run release:assets`。
- 新环境使用 `npm ci`；修改依赖或版本时保持 `package.json` 与 `package-lock.json` 同步。

## 文档、版本与设计资产

- 用户可见行为或安全变化应更新 `CHANGELOG.md` 的 `Unreleased`；发布遵循语义化版本、Keep a Changelog，以及与 `package.json` 版本一致的 annotated tag。
- 提交保持单一目的并使用 Conventional Commit；现有惯例是类型和作用域使用英文，说明可使用中文。
- 不提交数据库、备份、`EXE/`、`release/`、日志、调试输出或临时设计稿。`Designer/` 是经过整理的设计资产归档，不属于临时设计稿。
- 如果涉及设计更新，必须参考现有设计流程，将效果图按 `Designer/<大版本>/<YYYY-MM-DD_具体版本>/<类别>/` 归类保存，并同步维护 `Designer/README.md` 的版本与来源说明。
- 设计更新后必须检查 README 中的图片展示并对应替换；缺图时应补图。为保证结果精确，可以向开发者申请由开发者提供截图。
- 效果图和 README 截图只能使用脱敏演示数据。带有桌面环境或其他项目内容的原始截图只能作为内部历史参考，不得直接用于 README 或发布说明。
