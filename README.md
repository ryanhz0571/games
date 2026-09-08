# 🎮 初中生学习游戏聚合站

这是一个面向**初中生**的学习游戏聚合站，把学科知识点（目前是初一数学）做成游戏化关卡，边玩边学。全部使用 **TypeScript** 编写，并通过 **PWA** 增强——可以安装到桌面、离线游玩，每次进入站点会自动检查并更新到最新版本。

项目由 **Codex 配合 DeepSeek** 共同完成，技术指导来自爸爸。

## 在线试玩

| 游戏 | 说明 | 在线地址 |
| --- | --- | --- |
| 🐍 SUPER SNAKE 贪吃蛇 | NES 红白机风格经典贪吃蛇，含本地排行榜 | [开始游戏](https://ryanhz0571.github.io/games/snake-game/) |
| 🦊 数字大陆 | 多邻国式初一数学闯关，子关卡、每日打卡、等级系统 | [开始学习](https://ryanhz0571.github.io/games/math-game/) |

游戏大厅：[ryanhz0571.github.io/games](https://ryanhz0571.github.io/games/)

## 技术栈

- **TypeScript**：所有游戏逻辑与共享模块均为严格模式 TS
- **Vite**：多页面构建、资源内容哈希，保证新版本发布后浏览器能拿到新文件
- **PWA**：Web App Manifest + Service Worker，支持安装、离线缓存
- **自动更新**：每次进入页面检查 Service Worker 与版本号，发现新版后大厅自动刷新、游戏内提示手动更新
- **本地排行榜**：游戏开始前可输入昵称，成绩记录在本地 `localStorage`，每个昵称只保留最高分

## 游戏列表

### 🐍 SUPER SNAKE（贪吃蛇）

一个任天堂 NES 风格的经典贪吃蛇小游戏：像素字体、红白配色、扫描线屏幕，配 8-bit 复古音效。

![SUPER SNAKE 游戏画面](snake-game/screenshot.png)

**操作方式**

- 键盘：方向键或 WASD 控制移动，空格开始 / 暂停
- 手机：滑动屏幕控制方向，轻点屏幕开始 / 暂停，也可使用页面上的方向键（D-pad）
- 开始前可输入昵称，游戏结束后自动写入本地排行榜

更详细的开发说明见 [snake-game/README.md](snake-game/README.md)。

### 🦊 数字大陆（初一数学）

一个多邻国式的数学学习游戏，采用任天堂（马力欧）风格。按浙教版初一数学把内容拆成「分组 → 子关卡」，前两课已可玩：

- 第 1 课 · 认识负数
- 第 2 课 · 数轴与相反数

**学习机制**

- 分组与子关卡：数与运算、代数式、方程、图形与几何，每个分组下再拆子关卡，按顺序解锁
- 每日连续奖励：每天第一次打开会结算连续打卡并发放金币
- 等级系统：完成任务获得经验值（XP），每 100 分升一级
- 多种题型：选择题、数轴拖拽、填空、判断、排序，答错给出苏格拉底式提示

## 项目结构

```text
Ryan-Games/
├── index.html                  # 游戏大厅首页
├── src/
│   ├── home.ts / home.css      # 大厅页面
│   └── core/
│       ├── update.ts           # PWA 注册与新版本检查/更新
│       ├── leaderboard.ts      # 本地排行榜（通用）
│       ├── player.ts           # 玩家昵称
│       └── storage.ts          # 本地存储封装
├── public/
│   ├── manifest.webmanifest    # PWA 清单
│   └── icons/                  # 应用图标
├── snake-game/
│   ├── index.html              # 游戏页面
│   ├── style.css               # NES 风格样式
│   ├── src/main.ts             # 游戏逻辑（TS）
│   ├── screenshot.png
│   └── README.md               # 游戏详情
├── math-game/
│   ├── index.html              # 学习大厅（学习路径）
│   ├── play/index.html         # 做题页
│   ├── style.css               # 任天堂风格样式
│   └── src/
│       ├── home.ts             # 学习大厅逻辑
│       ├── main.ts             # 做题逻辑
│       ├── course.ts           # 课程结构
│       └── progress.ts         # 进度 / 等级 / 打卡
├── scripts/
│   ├── sw.template.js          # Service Worker 模板（构建时写入版本号）
│   └── make-icons.py           # 图标生成脚本
├── package.json / vite.config.ts / tsconfig.json
└── .github/workflows/pages.yml # 构建并部署 GitHub Pages
```

## 本地开发

需要 Node.js 与 pnpm：

```bash
pnpm install        # 安装依赖
pnpm dev            # 本地开发
pnpm typecheck      # TypeScript 类型检查
pnpm build          # 生产构建（输出到 dist/）
```

## 自动部署

每次推送 `main` 分支，GitHub Actions 会执行 `pnpm install → pnpm build`，再把 `dist/` 发布到 GitHub Pages；也可以在 Actions 页面手动触发（Run workflow）。
