import { Leaderboard } from "../../src/core/leaderboard";
import {
  loadPlayerName,
  normalizeName,
  sanitizeName,
  savePlayerName,
} from "../../src/core/player";
import { readStorage, writeStorage } from "../../src/core/storage";
import { setupAppUpdate } from "../../src/core/update";

// ---------- 配置 ----------
const GRID = 20; // 网格 20 x 20
const CELL = 24; // 每格像素
const START_SPEED = 150; // 初始速度（毫秒/步）
const MIN_SPEED = 70; // 最快速度
const SPEED_STEP = 4; // 每吃一个食物加快多少

interface Point {
  x: number;
  y: number;
}

const LEADERBOARD_KEY = "ryan-games:leaderboard:snake";

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const canvas = element<HTMLCanvasElement>("game");

function getContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  return context;
}

const ctx = getContext(canvas);

const overlay = element<HTMLDivElement>("overlay");
const overlayTitle = element<HTMLParagraphElement>("overlayTitle");
const overlayText = element<HTMLParagraphElement>("overlayText");
const overlayBlink = element<HTMLParagraphElement>("overlayBlink");
const scoreEl = element<HTMLSpanElement>("score");
const hiScoreEl = element<HTMLSpanElement>("hiScore");
const startBtn = element<HTMLButtonElement>("startBtn");
const pauseBtn = element<HTMLButtonElement>("pauseBtn");
const soundBtn = element<HTMLButtonElement>("soundBtn");
const playerNameInput = element<HTMLInputElement>("playerName");
const boardList = element<HTMLUListElement>("boardList");
const boardEmpty = element<HTMLParagraphElement>("boardEmpty");

// ---------- 状态 ----------
let snake: Point[] = [];
let dir: Point = { x: 1, y: 0 };
let nextDir: Point = { x: 1, y: 0 };
let food: Point | null = null;
let score = 0;
let hiScore = readScore("superSnakeHi");
let speed = START_SPEED;
let running = false;
let paused = false;
let gameOver = false;
let started = false;
let timer: number | null = null;
let muted = readStorage("superSnakeMuted") === "1";
let audioCtx: AudioContext | null = null;

const COL = {
  bg: "#0e1a2e",
  grid: "rgba(255,255,255,0.05)",
  border: "#2f4b77",
  head: "#7fe05a",
  body: "#3aa638",
  bodyAlt: "#2d8f30",
  food: "#ff3b30",
  foodLeaf: "#34c759",
  foodStem: "#8b5a2b",
};

const leaderboard = new Leaderboard(LEADERBOARD_KEY);

// ---------- 小工具 ----------
function rand(n: number): number {
  return Math.floor(Math.random() * n);
}

function fmt(n: number): string {
  return String(n).padStart(6, "0");
}

function readScore(key: string): number {
  const value = Number(readStorage(key) ?? "0");
  return Number.isFinite(value) ? value : 0;
}

function currentName(): string {
  return sanitizeName(playerNameInput.value) || "PLAYER";
}

function updateHud(): void {
  scoreEl.textContent = fmt(score);
  hiScoreEl.textContent = fmt(hiScore);
}

// ---------- 8-bit 音效 ----------
function ensureAudio(): void {
  if (!audioCtx) {
    const fallbackWindow = window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioClass = window.AudioContext ?? fallbackWindow.webkitAudioContext;
    if (AudioClass) audioCtx = new AudioClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  vol = 0.08,
  delay = 0,
): void {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

const sfx = {
  start(): void {
    beep(523, 0.1);
    beep(784, 0.12, "square", 0.08, 0.1);
  },
  eat(): void {
    beep(660, 0.07);
    beep(880, 0.09, "square", 0.08, 0.07);
  },
  turn(): void {
    beep(440, 0.035, "square", 0.035);
  },
  pause(): void {
    beep(330, 0.06, "square", 0.05);
  },
  over(): void {
    beep(392, 0.15, "sawtooth", 0.07);
    beep(262, 0.2, "sawtooth", 0.07, 0.15);
    beep(131, 0.35, "sawtooth", 0.07, 0.35);
  },
};

// ---------- 游戏逻辑 ----------
function reset(): void {
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  speed = START_SPEED;
  gameOver = false;
  paused = false;
  spawnFood();
  updateHud();
  draw();
}

function spawnFood(): void {
  while (true) {
    const candidate: Point = { x: rand(GRID), y: rand(GRID) };
    const occupied = snake.some(
      (segment) => segment.x === candidate.x && segment.y === candidate.y,
    );
    if (!occupied) {
      food = candidate;
      return;
    }
  }
}

function schedule(): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(tick, speed);
}

function tick(): void {
  if (!running || paused || gameOver) return;

  dir = nextDir;
  const head = snake[0];
  const nx = head.x + dir.x;
  const ny = head.y + dir.y;

  // 撞墙
  if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
    gameOverRun();
    return;
  }

  // 咬到自己（尾巴即将离开时不算撞）
  const willGrow = food !== null && nx === food.x && ny === food.y;
  const bodyToCheck = willGrow ? snake : snake.slice(0, -1);
  if (bodyToCheck.some((segment) => segment.x === nx && segment.y === ny)) {
    gameOverRun();
    return;
  }

  snake.unshift({ x: nx, y: ny });

  if (willGrow) {
    score += 10;
    speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
    if (score > hiScore) {
      hiScore = score;
      writeStorage("superSnakeHi", String(hiScore));
    }
    sfx.eat();
    spawnFood();
  } else {
    snake.pop();
  }

  updateHud();
  draw();
  schedule();
}

function gameOverRun(): void {
  gameOver = true;
  running = false;
  sfx.over();

  let recordText = "";
  if (score > 0) {
    const playerName = currentName();
    const result = leaderboard.submit(playerName, score);
    if (result) {
      if (result.isNew && result.improved) {
        recordText = "\n★ 已写入排行榜";
      } else if (result.improved) {
        recordText = "\n★ 打破个人纪录！";
      }
    }
  }

  renderBoard();
  draw();
  showOverlay(
    "GAME OVER",
    `本局得分 ${score}\n最高分 ${hiScore}${recordText}`,
    "PRESS SPACE TO RETRY",
  );
  startBtn.textContent = "RETRY";
  pauseBtn.disabled = true;
}

function startGame(): void {
  ensureAudio();
  reset();
  running = true;
  started = true;
  sfx.start();
  hideOverlay();
  startBtn.textContent = "RESTART";
  pauseBtn.disabled = false;
  pauseBtn.textContent = "PAUSE";
  schedule();
}

function startRun(): void {
  const name = currentName();
  savePlayerName(name);
  playerNameInput.value = name;
  playerNameInput.blur();
  startGame();
}

function togglePause(): void {
  if (!running || gameOver) return;
  paused = !paused;
  sfx.pause();
  if (paused) {
    showOverlay("PAUSE", "按 空格 继续", null);
    draw();
  } else {
    hideOverlay();
    schedule();
    draw();
  }
}

// ---------- 画面 ----------
function draw(): void {
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
}

function drawGrid(): void {
  ctx.strokeStyle = COL.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(canvas.width, i * CELL);
    ctx.stroke();
  }
  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
}

function drawFood(): void {
  if (!food) return;
  const x = food.x * CELL;
  const y = food.y * CELL;
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  const r = CELL * 0.36;

  // 苹果
  ctx.fillStyle = COL.food;
  ctx.beginPath();
  ctx.arc(cx, cy + 1, r, 0, Math.PI * 2);
  ctx.fill();

  // 高光
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // 果柄
  ctx.strokeStyle = COL.foodStem;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.8);
  ctx.lineTo(cx + 1, cy - r * 1.15);
  ctx.stroke();

  // 叶子
  ctx.fillStyle = COL.foodLeaf;
  ctx.beginPath();
  ctx.ellipse(cx + 6.5, cy - r, 4.6, 2.4, -0.55, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSnake(): void {
  snake.forEach((segment, index) => {
    const pad = index === 0 ? 1.5 : 3;
    const radius = index === 0 ? 8 : 6;
    roundRect(
      segment.x * CELL + pad,
      segment.y * CELL + pad,
      CELL - pad * 2,
      CELL - pad * 2,
      radius,
    );
    ctx.fillStyle = index === 0 ? COL.head : index % 2 === 0 ? COL.body : COL.bodyAlt;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  drawEyes();
}

function drawEyes(): void {
  const head = snake[0];
  if (!head) return;
  const cx = head.x * CELL + CELL / 2;
  const cy = head.y * CELL + CELL / 2;
  const px = -dir.y; // 垂直方向
  const py = dir.x;
  const eyeOffset = 5.5;
  const forwardOffset = 4;

  for (const side of [-1, 1]) {
    const ex = cx + px * eyeOffset * side + dir.x * forwardOffset;
    const ey = cy + py * eyeOffset * side + dir.y * forwardOffset;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ex, ey, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(ex + dir.x * 1.4, ey + dir.y * 1.4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- 排行榜 ----------
function renderBoard(): void {
  const entries = leaderboard.shown();
  boardList.replaceChildren();

  if (entries.length === 0) {
    boardEmpty.style.display = "block";
    return;
  }
  boardEmpty.style.display = "none";

  const me = normalizeName(currentName());
  entries.forEach((entry, index) => {
    const item = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "board-rank";
    rank.textContent = String(index + 1);
    if (index < 3) rank.classList.add("top");

    const name = document.createElement("span");
    name.className = "board-name";
    name.textContent = entry.name;
    if (normalizeName(entry.name) === me) item.classList.add("mine");

    const points = document.createElement("span");
    points.className = "board-score";
    points.textContent = String(entry.score);

    item.append(rank, name, points);
    boardList.append(item);
  });
}

// ---------- 遮罩层 ----------
function showOverlay(
  title: string,
  text: string,
  blink: string | null,
): void {
  overlayTitle.textContent = title || "";
  overlayTitle.classList.toggle("gameover", title === "GAME OVER");
  overlayText.textContent = text || "";
  overlayBlink.textContent = blink || "";
  overlayBlink.style.display = blink ? "block" : "none";
  overlay.classList.remove("hidden");
}

function hideOverlay(): void {
  overlay.classList.add("hidden");
}

// ---------- 输入 ----------
function setDir(x: number, y: number): void {
  if (!started || gameOver) return;
  if (x === -dir.x && y === -dir.y) return; // 禁止直接掉头
  if (x === dir.x && y === dir.y) return;
  ensureAudio();
  sfx.turn();
  nextDir = { x, y };
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  let handled = true;

  if (key === "arrowup" || key === "w") setDir(0, -1);
  else if (key === "arrowdown" || key === "s") setDir(0, 1);
  else if (key === "arrowleft" || key === "a") setDir(-1, 0);
  else if (key === "arrowright" || key === "d") setDir(1, 0);
  else if (key === " ") {
    if (!started || gameOver) startRun();
    else togglePause();
  } else if (key === "enter") {
    if (!started || gameOver) startRun();
  } else {
    handled = false;
  }

  if (handled) event.preventDefault();
});

// 手机上滑动控制
let touchStart: Point | null = null;
canvas.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  },
  { passive: true },
);

canvas.addEventListener(
  "touchend",
  (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) {
      // 轻点屏幕：开始或暂停
      if (!started || gameOver) startRun();
      else togglePause();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
  },
  { passive: true },
);

// ---------- 按钮与输入 ----------
startBtn.addEventListener("click", () => startRun());
pauseBtn.addEventListener("click", () => togglePause());

soundBtn.addEventListener("click", () => {
  muted = !muted;
  writeStorage("superSnakeMuted", muted ? "1" : "0");
  soundBtn.textContent = muted ? "SOUND OFF" : "SOUND ON";
  ensureAudio();
  if (!muted) sfx.start();
});

playerNameInput.addEventListener("click", (event) => event.stopPropagation());
playerNameInput.addEventListener("keydown", (event) => {
  event.stopPropagation();
  if (event.key === "Enter") {
    event.preventDefault();
    startRun();
  }
});
playerNameInput.addEventListener("input", () => {
  savePlayerName(playerNameInput.value);
  renderBoard();
});

document.querySelectorAll<HTMLButtonElement>(".dpad-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const direction = button.dataset.dir;
    const x = direction === "left" ? -1 : direction === "right" ? 1 : 0;
    const y = direction === "up" ? -1 : direction === "down" ? 1 : 0;
    setDir(x, y);
  });
});

// 点击遮罩层 = 开始/暂停
overlay.addEventListener("click", () => {
  if (!started || gameOver) startRun();
  else togglePause();
});

// ---------- 启动 ----------
function init(): void {
  soundBtn.textContent = muted ? "SOUND OFF" : "SOUND ON";
  playerNameInput.value = loadPlayerName();
  reset();
  renderBoard();
  showOverlay(
    "SUPER SNAKE",
    "经典贪吃蛇\n方向键 / WASD 控制\n吃到苹果变长，撞墙或咬到自己结束",
    "PRESS START",
  );
}

setupAppUpdate({ mode: "prompt" });
init();
