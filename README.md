# 🎮 Games — 浏览器小游戏合集

Ryan 的浏览器小游戏合集：全部使用 **TypeScript** 编写，并通过 **PWA** 增强——可以安装到桌面、离线游玩，每次进入站点会自动检查并更新到最新版本。项目由 Codex / Claude 辅助制作。

## 在线试玩

| 游戏 | 说明 | 在线地址 |
| --- | --- | --- |
| 🐍 SUPER SNAKE 贪吃蛇 | NES 红白机风格经典贪吃蛇，含本地排行榜 | [开始游戏](https://ryanhz0571.github.io/games/snake-game/) |

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
