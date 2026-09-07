# 🎮 Games — 浏览器小游戏合集

Ryan 的浏览器小游戏合集：全部用纯 HTML、CSS、JavaScript 编写，零依赖、零构建，打开网页即可游玩。项目由 Codex / Claude 辅助制作。

## 在线试玩

GitHub Pages 自动部署，无需安装任何东西，点击即可开始：

| 游戏 | 说明 | 在线地址 |
| --- | --- | --- |
| 🐍 SUPER SNAKE 贪吃蛇 | NES 红白机风格经典贪吃蛇 | [开始游戏](https://ryanhz0571.github.io/games/snake-game/) |

仓库站点首页：[ryanhz0571.github.io/games](https://ryanhz0571.github.io/games/)

## 游戏列表

### 🐍 SUPER SNAKE（贪吃蛇）

一个任天堂 NES 风格的经典贪吃蛇小游戏：像素字体、红白配色、扫描线屏幕，配 8-bit 复古音效。

![SUPER SNAKE 游戏画面](snake-game/screenshot.png)

**操作方式**

- 键盘：方向键或 WASD 控制移动，空格开始 / 暂停
- 手机：滑动屏幕控制方向，轻点屏幕开始 / 暂停，也可使用页面上的方向键（D-pad）
- 吃到苹果蛇会变长，分数 +10，速度会逐渐加快
- 撞到墙壁或咬到自己游戏结束，最高分会保存在本机浏览器中

**游戏特性**

- NES 红白机风格界面：像素字体、扫描线屏幕
- 8-bit 复古音效，可随时静音
- 开始 / 暂停 / 重新开始
- 计分与加速、最高分记录
- 支持键盘、鼠标和触屏操作

更详细的开发说明见 [snake-game/README.md](snake-game/README.md)。

## 项目结构

```text
Ryan-Games/
├── index.html          # 站点首页（自动跳转到最新游戏）
├── snake-game/         # SUPER SNAKE 贪吃蛇
│   ├── index.html      # 游戏页面
│   ├── style.css       # NES 风格样式
│   ├── game.js         # 游戏逻辑与音效
│   ├── screenshot.png  # 游戏截图
│   └── README.md       # 游戏详情
└── .github/
    └── workflows/
        └── pages.yml   # GitHub Pages 自动部署工作流
```

## 本地运行

无需安装任何依赖，任选其一：

- 直接双击打开 `snake-game/index.html`
- 或在本目录启动一个静态服务器：

  ```bash
  python -m http.server 8000
  ```

  然后在浏览器访问 <http://localhost:8000>。

## 自动部署

仓库内置 GitHub Actions 工作流 [.github/workflows/pages.yml](.github/workflows/pages.yml)：每次推送 `main` 分支都会自动将整个仓库部署到 GitHub Pages，也可在 Actions 页面手动触发（Run workflow）。
