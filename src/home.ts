import "./home.css";
import { setupAppUpdate } from "./core/update";

interface GameInfo {
  emoji: string;
  name: string;
  tag: string;
  description: string;
  href: string;
}

const GAMES: GameInfo[] = [
  {
    emoji: "🐍",
    name: "SUPER SNAKE",
    tag: "NES 贪吃蛇",
    description:
      "经典贪吃蛇：像素红白机风格、8-bit 音效，支持键盘与触屏，内置本地排行榜。",
    href: "./snake-game/",
  },
  {
    emoji: "🦊",
    name: "数字大陆",
    tag: "初一数学 · 多邻国式",
    description:
      "多邻国式数学闯关：数轴拖拽、天平解方程，先学有理数，iPad 横屏与电脑都能玩。",
    href: "./math-game/",
  },
];

function buildCards(): void {
  const container = document.getElementById("games");
  if (!container) return;

  for (const game of GAMES) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = game.href;

    const emoji = document.createElement("div");
    emoji.className = "card-emoji";
    emoji.textContent = game.emoji;

    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = game.name;
    const small = document.createElement("small");
    small.textContent = ` · ${game.tag}`;
    title.append(small);

    const description = document.createElement("p");
    description.className = "card-desc";
    description.textContent = game.description;

    const go = document.createElement("span");
    go.className = "card-go";
    go.textContent = "开始游戏 →";

    card.append(emoji, title, description, go);
    container.append(card);
  }
}

function markReady(): void {
  const footer = document.getElementById("footerText");
  if (footer) {
    footer.textContent = "在线可玩 · 离线同样可以打开已玩过的游戏";
  }
}

buildCards();
markReady();
setupAppUpdate({ mode: "auto" });
