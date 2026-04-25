# AccountManager / 本地账号管家

一个基于 **Electron + React + Vite** 的本地桌面账号管家，1.x 版本只聚焦三件事：

1. 管理 `Google` 和 `Microsoft` 主账号
2. 用标签记录这些主账号登录过的平台
3. 管理并查看关联的 `2FA` 动态口令

![演示视频](myFolder/v.beta.0.1演示.gif)

---

## 核心特性

### 1. 主账号管理

- 完全离线运行，数据存放在本地 SQLite
- 重点管理 `Google` / `Microsoft` 主账号
- 支持保存登录账号、密码、手机号、备用邮箱、备注
- 支持自定义字段，方便记录恢复信息、购买来源、环境说明等
- 提供回收站，账号先软删除，再决定是否彻底清理

### 2. 平台标签

- 用全局复用标签记录“这个 Google / Microsoft 账号注册过哪些平台”
- 标签适合记录 `GitHub`、`Discord`、`Notion`、`Figma`、`OpenAI` 等第三方平台
- 新建或维护标签时不需要额外建独立账号

### 3. 2FA 验证器

- 内建 `TOTP / HOTP` 认证器
- 支持把账号里的 2FA 密钥联动生成到独立验证器面板
- 2FA 卡片可以反向跳转到所属账号
- 删除主账号后，关联的 2FA 会保留为孤立提醒状态，避免误删

### 4. 本地备份

- 支持导入 / 导出本地数据库
- 支持 CSV 导入旧账号数据

---

## 技术栈

- **构建系统**: Vite
- **底层架构**: Electron
- **前端框架**: React 18 + TypeScript
- **状态管理**: Zustand
- **本地数据库**: better-sqlite3
- **组件库**: Material UI v5
- **2FA**: otpauth

---

## 安装与运行

### 依赖环境

- Node.js 18+
- 由于使用了 SQLite 原生依赖，开发机需要可用的 node-gyp 编译环境

### 开发

```bash
npm install
npm run electron:dev
```

### 测试

```bash
npm test
```

### 打包

```bash
npm run build
```

构建产物会输出到 `release/win-unpacked`。

---

## 目录结构

```text
AccountManager/
├── electron/                 # Electron 主线程与 SQLite / IPC
├── src/
│   ├── components/           # 账号、2FA、回收站等界面
│   ├── stores/               # Zustand 状态
│   ├── utils/                # 平台与标签辅助逻辑
│   ├── theme/                # MUI 主题
│   ├── App.tsx               # 应用外壳
│   └── main.tsx              # React 入口
└── package.json
```

---

## 隐私说明

应用不包含自建云同步或分析埋点。账号记录、标签、2FA 种子与数据库备份均由本机 `account-manager.db` 管理，你可以自行备份和迁移。
