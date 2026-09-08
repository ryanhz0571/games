import { Leaderboard } from "../../src/core/leaderboard";
import {
  loadPlayerName,
  normalizeName,
  sanitizeName,
  savePlayerName,
} from "../../src/core/player";
import { readStorage, writeStorage } from "../../src/core/storage";
import { setupPageTransitions } from "../../src/core/transition";
import { setupAppUpdate } from "../../src/core/update";
import {
  getUnit,
  shuffle,
  WORD_UNITS,
  type EnglishWord,
  type WordUnit,
} from "./word-data";

// ---------- 配置 ----------
const GRID = 20; // 网格 20 x 20
const CELL = 24; // 每格像素
const START_SPEED = 150; // 初始速度（毫秒/步）
const MIN_SPEED = 70; // 最快速度
const SPEED_STEP = 4; // 每吃一个食物加快多少
const WORD_START_SPEED = 240; // 单词模式给足反应时间
const WORD_MIN_SPEED = 140;
const WORD_SPEED_STEP = 3;
const COUNTDOWN_SECONDS = 15; // 每轮默认倒计时

interface Point {
  x: number;
  y: number;
}

type GameMode = "word" | "classic";

interface WordFood extends Point {
  slot: number;
  word: EnglishWord;
}

interface WordWave {
  target: EnglishWord;
  options: EnglishWord[];
}

const LEADERBOARD_KEY = "ryan-games:leaderboard:snake";
const SLOT_COLORS = ["#ff4b3e", "#2dc07c", "#ffcf00"];
const SLOT_LETTERS = ["A", "B", "C"];

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
const modeWordBtn = element<HTMLButtonElement>("modeWordBtn");
const modeClassicBtn = element<HTMLButtonElement>("modeClassicBtn");
const unitSelect = element<HTMLSelectElement>("unitSelect");
const wordBar = element<HTMLDivElement>("wordBar");
const promptZh = element<HTMLSpanElement>("promptZh");
const wordTimer = element<HTMLSpanElement>("wordTimer");
const choiceRow = element<HTMLDivElement>("choiceRow");
const wordHint = element<HTMLParagraphElement>("wordHint");
const wordSummaryCard = element<HTMLElement>("wordSummaryCard");
const wordSummaryList = element<HTMLUListElement>("wordSummaryList");
const wordSummaryEmpty = element<HTMLParagraphElement>("wordSummaryEmpty");

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
let gameMode: GameMode = "word";
let selectedUnitId = "starter-1";
let wordFoods: WordFood[] = [];
let wordWave: WordWave | null = null;
let sessionWords: EnglishWord[] = [];
let wordQueue: EnglishWord[] = [];
let lastWord: EnglishWord | null = null;
let hintTimer: number | null = null;
let countdownRemaining = COUNTDOWN_SECONDS;
let countdownTimer: number | null = null;

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
  wrong(): void {
    beep(180, 0.09, "square", 0.05);
    beep(140, 0.16, "sawtooth", 0.06, 0.09);
  },
  over(): void {
    beep(392, 0.15, "sawtooth", 0.07);
    beep(262, 0.2, "sawtooth", 0.07, 0.15);
    beep(131, 0.35, "sawtooth", 0.07, 0.35);
  },
};

// ---------- 单词学习工具 ----------
function currentUnit(): WordUnit {
  return getUnit(selectedUnitId);
}

function speakEnglish(text: string): void {
  if (!("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // 不支持语音时静默跳过
  }
}

function flashWordHint(message: string, wrong = false): void {
  if (hintTimer !== null) window.clearTimeout(hintTimer);
  wordHint.textContent = message;
  wordHint.classList.toggle("wrong", wrong);
  wordHint.hidden = false;
  hintTimer = window.setTimeout(() => {
    wordHint.hidden = true;
  }, 3200);
}

function canPlaceFood(x: number, y: number): boolean {
  if (snake.some((segment) => segment.x === x && segment.y === y)) return false;
  if (wordFoods.some((item) => item.x === x && item.y === y)) return false;
  if (food && food.x === x && food.y === y) return false;
  return true;
}

function placeClassicFood(): void {
  for (let attempt = 0; attempt < 800; attempt++) {
    const candidate: Point = { x: rand(GRID), y: rand(GRID) };
    if (canPlaceFood(candidate.x, candidate.y)) {
      food = candidate;
      return;
    }
  }
  food = null;
}

function renderWordChoices(): void {
  choiceRow.replaceChildren();
  if (!wordWave) return;

  wordWave.options.forEach((option, slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.dataset.slot = String(slot);

    const dot = document.createElement("span");
    dot.className = "choice-dot";
    dot.style.background = SLOT_COLORS[slot] ?? "#fff";

    const label = document.createElement("span");
    label.className = "choice-text";
    label.textContent = `${SLOT_LETTERS[slot]} · ${option.word}`;

    button.append(dot, label);
    button.addEventListener("click", () => speakEnglish(option.word));
    choiceRow.append(button);
  });
}

function tryPlaceWordFood(item: WordFood): boolean {
  for (let attempt = 0; attempt < 800; attempt++) {
    const candidate: Point = { x: rand(GRID), y: rand(GRID) };
    if (canPlaceFood(candidate.x, candidate.y)) {
      item.x = candidate.x;
      item.y = candidate.y;
      return true;
    }
  }
  return false;
}

function renderCountdown(): void {
  wordTimer.textContent = `${Math.max(0, countdownRemaining)}s`;
  wordTimer.classList.toggle("low", countdownRemaining <= 5);
}

function stopCountdown(): void {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startCountdown(): void {
  stopCountdown();
  countdownRemaining = COUNTDOWN_SECONDS;
  renderCountdown();
  countdownTimer = window.setInterval(() => {
    if (!running || paused || gameOver || gameMode !== "word") return;
    countdownRemaining -= 1;
    renderCountdown();
    if (countdownRemaining <= 0) onWordTimeout();
  }, 1000);
}

function shrinkSnakeBy(amount: number): void {
  let remaining = amount;
  while (remaining > 0 && snake.length > 2) {
    snake.pop();
    remaining -= 1;
  }
}

function onWordTimeout(): void {
  if (!running || paused || gameOver || gameMode !== "word") return;
  stopCountdown();
  if (wordWave) {
    flashWordHint(
      `时间到！${wordWave.target.word} = ${wordWave.target.zh}`,
      true,
    );
  }
  sfx.wrong();
  shrinkSnakeBy(2);
  if (!startWordWave()) {
    gameOverRun();
    return;
  }
  draw();
}

function startWordWave(): boolean {
  const unit = currentUnit();
  if (unit.words.length < 3) return false;

  if (wordQueue.length === 0) {
    wordQueue = shuffle(unit.words);
    if (
      lastWord &&
      wordQueue.length > 1 &&
      wordQueue[0].word === lastWord.word
    ) {
      [wordQueue[0], wordQueue[1]] = [wordQueue[1], wordQueue[0]];
    }
  }

  const target = wordQueue.shift();
  if (!target) return false;
  lastWord = target;

  const distractors = shuffle(
    unit.words.filter((item) => item.word !== target.word),
  ).slice(0, 2);
  const options = shuffle([target, ...distractors]);
  wordWave = { target, options };
  wordFoods = [];

  for (let slot = 0; slot < options.length; slot++) {
    const item: WordFood = { x: -1, y: -1, slot, word: options[slot] };
    if (!tryPlaceWordFood(item)) {
      wordFoods = [];
      wordWave = null;
      return false;
    }
    wordFoods.push(item);
  }

  promptZh.textContent = `“${target.zh}”`;
  wordHint.hidden = true;
  renderWordChoices();
  startCountdown();
  return true;
}

function endGameBecauseFull(): void {
  gameOverRun();
}

// ---------- 游戏逻辑 ----------
function reset(): void {
  stopCountdown();
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  speed = gameMode === "word" ? WORD_START_SPEED : START_SPEED;
  gameOver = false;
  paused = false;
  food = null;
  wordFoods = [];
  wordWave = null;
  sessionWords = [];
  wordQueue = [];
  lastWord = null;
  wordSummaryCard.hidden = true;
  wordSummaryList.replaceChildren();

  if (gameMode === "word") {
    if (!startWordWave()) {
      endGameBecauseFull();
      return;
    }
  } else {
    placeClassicFood();
  }

  updateHud();
  draw();
}

function schedule(): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(tick, speed);
}

function isTargetWordFood(item: WordFood): boolean {
  return wordWave !== null && item.word.word === wordWave.target.word;
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

  const classicHit =
    gameMode === "classic" &&
    food !== null &&
    nx === food.x &&
    ny === food.y;
  const wordHitIndex =
    gameMode === "word"
      ? wordFoods.findIndex(
          (item) => item.x === nx && item.y === ny,
        )
      : -1;
  const wordHit =
    wordHitIndex >= 0 ? (wordFoods[wordHitIndex] ?? null) : null;

  // 咬到自己（尾巴即将离开时不算撞）
  const willGrow =
    classicHit ||
    (wordHit !== null && isTargetWordFood(wordHit));
  const bodyToCheck = willGrow ? snake : snake.slice(0, -1);
  if (bodyToCheck.some((segment) => segment.x === nx && segment.y === ny)) {
    gameOverRun();
    return;
  }

  snake.unshift({ x: nx, y: ny });

  if (classicHit && food) {
    score += 10;
    speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
    if (score > hiScore) {
      hiScore = score;
      writeStorage("superSnakeHi", String(hiScore));
    }
    sfx.eat();
    placeClassicFood();
  } else if (wordHit !== null) {
    wordFoods.splice(wordHitIndex, 1);
    if (isTargetWordFood(wordHit)) {
      const firstTime = !sessionWords.some(
        (learned) => learned.word === wordHit.word.word,
      );
      if (firstTime) {
        sessionWords.push(wordHit.word);
        score += 20;
      } else {
        score += 10;
      }
      speed = Math.max(WORD_MIN_SPEED, speed - WORD_SPEED_STEP);
      if (score > hiScore) {
        hiScore = score;
        writeStorage("superSnakeHi", String(hiScore));
      }
      sfx.eat();
      speakEnglish(wordHit.word.word);
      if (!startWordWave()) {
        gameOverRun();
        return;
      }
    } else {
      shrinkSnakeBy(2);
      score = Math.max(0, score - 5);
      sfx.wrong();
      flashWordHint(`${wordHit.word.word} = ${wordHit.word.zh}`, true);
    }
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
  stopCountdown();
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
  renderWordSummary();
  draw();
  const wordsLearned =
    gameMode === "word" && sessionWords.length > 0
      ? `\n本局掌握 ${sessionWords.length} 个单词`
      : "";
  showOverlay(
    "GAME OVER",
    `本局得分 ${score}\n最高分 ${hiScore}${wordsLearned}${recordText}`,
    "PRESS SPACE TO RETRY",
  );
  startBtn.textContent = "RETRY";
  pauseBtn.disabled = true;
  updateModeUI();
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
  updateModeUI();
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

function renderWordSummary(): void {
  wordSummaryList.replaceChildren();
  if (gameMode !== "word" || sessionWords.length === 0) {
    wordSummaryCard.hidden = true;
    return;
  }

  wordSummaryCard.hidden = false;
  wordSummaryEmpty.hidden = true;
  sessionWords.forEach((word) => {
    const item = document.createElement("li");
    const en = document.createElement("span");
    en.className = "word-summary-en";
    en.textContent = word.word;

    const zh = document.createElement("span");
    zh.className = "word-summary-zh";
    zh.textContent = word.zh;
    const tip = document.createElement("small");
    tip.textContent = "点击听发音";
    zh.append(tip);

    item.append(en, zh);
    item.addEventListener("click", () => speakEnglish(word.word));
    wordSummaryList.append(item);
  });
}

function updateModeUI(): void {
  const wordMode = gameMode === "word";
  const locked = started && !gameOver;
  modeWordBtn.classList.toggle("active", wordMode);
  modeClassicBtn.classList.toggle("active", !wordMode);
  modeWordBtn.disabled = locked;
  modeClassicBtn.disabled = locked;
  wordBar.hidden = !wordMode;
  unitSelect.disabled = !wordMode || locked;
}

function switchGameMode(mode: GameMode): void {
  if (mode === gameMode) return;
  if (started && !gameOver) return; // 游戏中不允许切换，避免打断
  gameMode = mode;
  updateModeUI();
  renderBoard();
}

function showStartIntro(): void {
  const title = gameMode === "word" ? "WORD SNAKE" : "SUPER SNAKE";
  const text =
    gameMode === "word"
      ? "单词闯关模式\n看中文意思，把蛇引向正确颜色的单词\n答对 +20 并听发音，答错会立刻讲解"
      : "经典贪吃蛇\n方向键 / WASD 控制\n吃到苹果变长，撞墙或咬到自己结束";
  showOverlay(title, text, "PRESS START");
}

// ---------- 画面 ----------
function draw(): void {
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  if (gameMode === "word") drawWordFoods();
  else drawFood();
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

function drawWordFoods(): void {
  wordFoods.forEach((item) => {
    const x = item.x * CELL;
    const y = item.y * CELL;
    const cx = x + CELL / 2;
    const color = SLOT_COLORS[item.slot] ?? "#fff";
    const letter = SLOT_LETTERS[item.slot] ?? "?";

    // 彩色“单词球”
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, y + CELL - 6, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(cx - 2, y + CELL - 8, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 对应选项的 A/B/C 标签
    ctx.fillStyle = "rgba(8,12,26,0.9)";
    ctx.fillRect(cx - 6, y + 2, 12, 12);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 6, y + 2, 12, 12);
    ctx.fillStyle = item.slot === 2 ? "#1a1400" : "#fff";
    ctx.font = "bold 9px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, cx, y + 8.5);
  });
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

modeWordBtn.addEventListener("click", () => switchGameMode("word"));
modeClassicBtn.addEventListener("click", () => switchGameMode("classic"));
unitSelect.addEventListener("change", () => {
  selectedUnitId = unitSelect.value;
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
function populateUnitSelect(): void {
  unitSelect.replaceChildren();
  WORD_UNITS.forEach((unit) => {
    const option = document.createElement("option");
    option.value = unit.id;
    option.textContent = unit.label;
    unitSelect.append(option);
  });
  unitSelect.value = selectedUnitId;
}

function init(): void {
  setupPageTransitions();
  populateUnitSelect();
  soundBtn.textContent = muted ? "SOUND OFF" : "SOUND ON";
  playerNameInput.value = loadPlayerName();
  updateModeUI();
  reset();
  renderBoard();
  showStartIntro();
}

setupAppUpdate({ mode: "prompt" });
init();
