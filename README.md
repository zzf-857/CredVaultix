# AccountManager / 本地账号管家 🛡️

一款基于 **Electron + React + Vite** 开发的现代化本地桌面客户端，不仅提供强大的 Prompt 文本管理功能，更是一个高度可定制化、数据完全本地掌控的 **账号存储与 2FA (双因素身份验证) 管理器**。

![演示视频](myFolder/v.beta.0.1演示.gif)

---

## ✨ 核心特性

### 1. 🔐 本地账号密码管理
- **完全离线运行**：数据保存在本地 SQLite 数据库，无任何云端同步逻辑，彻底拒绝数据上云泄露风险。
- **自定义加密字段**：除了预设的（账号名、登录名、密码、手机、备用邮箱），你还可以为每个账号无限添加自定义属性，独立设置「是否加密隐藏」以防偷窥。
- **右键快键指令**：账号列表支持右键弹出「快速设置」与「删除」等顺畅的交互逻辑。

### 2. 🔐 2FA / 动态口令验证器
- **内建认证器**：不仅是一个密码备忘录，还内置了和 Google Authenticator 一样的功能。
- **TOTP / HOTP 支持**：支持基于时间（TOTP）和基于计数器（HOTP）的两种 2FA 双因素口令算法。
- **交互式向导联动**：填入 2FA 密钥后自动检测，并可通过交互式向导一键将账号和对应的 2FA 口令信息绑定流转至验证器面板。
- **智能孤儿卡片保护**：删除主账号后，关联的 2FA 的信息会被防呆保留，并转为 `⚠️主账号已删` 的警示状态，杜绝误操作。

### 3. 📝 Markdown 文本管理器
- **Prompt 与文档管理**：不仅记录账号，还可以通过文件夹结构和 Tag 标签体系，对重要的文本提示词（Prompt）、技术备忘或者其他资料进行管理。
- **一键复制**：提供极为便捷的操作交互，沉浸式的查看和一键获取。

### 4. 🎨 现代化 UI / UX
- **Material Design 3**：基于最新的 MUI，内置浅色 / 深色双主题无缝切换。
- **沉浸式无边框窗口**：自定义带有系统原生视效的吸附拖拽标题栏。

---

## 🚀 技术栈

- **构建系统**: Vite
- **底层架构**: Electron (Main/Renderer Process IPC)
- **前端框架**: React 18 + TypeScript
- **状态管理**: Zustand
- **本地数据库**: Better-SQLite3 (持久化) / 数据库结构升级热迁移能力
- **组件库**: Material-UI (MUI v5)
- **双因子认证**: otpauth 库集成

---

## 📦 安装与运行

### 依赖环境
- Node.js (推荐 v18+)
- 针对本机由于使用了 SQLite 的 C++ bindings，开发机器可能需要装有 node-gyp 运行所需的编译环境。

### 开发调试

\`\`\`bash
# 1. 安装项目依赖
npm install

# 2. 运行本地开发环境 (Vite + Electron)
npm run dev
```

### 生产环境打包

```bash
# 构建 Windows 可执行应用 (.exe)
npm run build
```
编译输出文件将存放在项目的 `release/win-unpacked` 目录内，双击运行即可。

---

## 📁 核心目录结构

```text
AccountManager/
├── electron/                 # Electron 主线程源码
│   ├── main.ts               # 窗口管理及 IPC 控制器
│   ├── database.ts           # SQLite 本地环境与增量迁移
│   ├── preload.ts            # 安全上下文隔离与 API 桥接层
│   └── crypto.ts             # 本地数据部分重度加密实现
├── src/                      # 前端 React / Vite 渲染层源码
│   ├── components/           # 所有业务组件与 UI 画布部件
│   ├── stores/               # Zustand 跨面板状态共享
│   ├── theme/                # Material UI 动态多套主题配置
│   ├── types.ts              # 泛型及统一的 Type 声明
│   ├── App.tsx               # 前端页面的基础骨架与三栏切分布局
│   └── main.tsx              # React 并发模式渲染入口
├── .antigravityignore        # AI Agent 控制防修改锁定文件
└── package.json              # NPM 模块依赖
\`\`\`

---

## 🔒 隐私声明
此应用 **不包含** 任何形式的网络请求或分析埋点（Telemetries）。所有的账户记录、密钥和 2FA 种子数据均由本机内的 Electron UserData 下的 `account-manager.db` 文件全权接管，你完全可控并自由负责数据备份留档。


