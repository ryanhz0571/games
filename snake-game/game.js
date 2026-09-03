(function () {
  "use strict";

  // ---------- 配置 ----------
  const GRID = 20;            // 网格 20 x 20
  const CELL = 24;            // 每格像素
  const START_SPEED = 150;    // 初始速度（毫秒/步）
  const MIN_SPEED = 70;       // 最快速度
  const SPEED_STEP = 4;       // 每吃一个食物加快多少

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const overlayBlink = document.getElementById("overlayBlink");
  const scoreEl = document.getElementById("score");
  const hiScoreEl = document.getElementById("hiScore");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const soundBtn = document.getElementById("soundBtn");

  // ---------- 状态 ----------
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = null;
  let score = 0;
  let hiScore = Number(localStorage.getItem("superSnakeHi") || 0);
  let speed = START_SPEED;
  let running = false;
  let paused = false;
  let gameOver = false;
  let started = false;
  let timer = null;
  let muted = localStorage.getItem("superSnakeMuted") === "1";
  let audioCtx = null;

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

  // ---------- 小工具 ----------
  function rand(n) {
    return Math.floor(Math.random() * n);
  }

  function fmt(n) {
    return String(n).padStart(6, "0");
  }

  function updateHud() {
    scoreEl.textContent = fmt(score);
    hiScoreEl.textContent = fmt(hiScore);
  }

  // ---------- 8-bit 音效 ----------
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function beep(freq, dur, type, vol, delay) {
    if (muted || !audioCtx) return;
    const t = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol == null ? 0.08 : vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  const sfx = {
    start: function () {
      beep(523, 0.1);
      beep(784, 0.12, "square", 0.08, 0.1);
    },
    eat: function () {
      beep(660, 0.07);
      beep(880, 0.09, "square", 0.08, 0.07);
    },
    turn: function () {
      beep(440, 0.035, "square", 0.035);
    },
    pause: function () {
      beep(330, 0.06, "square", 0.05);
    },
    over: function () {
      beep(392, 0.15, "sawtooth", 0.07);
      beep(262, 0.2, "sawtooth", 0.07, 0.15);
      beep(131, 0.35, "sawtooth", 0.07, 0.35);
    },
  };

  // ---------- 游戏逻辑 ----------
  function reset() {
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

  function spawnFood() {
    while (true) {
      const f = { x: rand(GRID), y: rand(GRID) };
      if (!snake.some(function (s) { return s.x === f.x && s.y === f.y; })) {
        food = f;
        return;
      }
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, speed);
  }

  function tick() {
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
    if (bodyToCheck.some(function (s) { return s.x === nx && s.y === ny; })) {
      gameOverRun();
      return;
    }

    snake.unshift({ x: nx, y: ny });

    if (willGrow) {
      score += 10;
      speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
      if (score > hiScore) {
        hiScore = score;
        localStorage.setItem("superSnakeHi", String(hiScore));
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

  function gameOverRun() {
    gameOver = true;
    running = false;
    sfx.over();
    draw();
    showOverlay("GAME OVER", "本局得分 " + score + "\n最高分 " + hiScore, "PRESS SPACE TO RETRY");
    startBtn.textContent = "RETRY";
    pauseBtn.disabled = true;
  }

  function startGame() {
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

  function togglePause() {
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
  function draw() {
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawFood();
    drawSnake();
  }

  function drawGrid() {
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

  function drawFood() {
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
    ctx.ellipse(cx + 6.5, cy - r * 1.0, 4.6, 2.4, -0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSnake() {
    snake.forEach(function (s, i) {
      const pad = i === 0 ? 1.5 : 3;
      const r = i === 0 ? 8 : 6;
      roundRect(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, r);
      ctx.fillStyle = i === 0 ? COL.head : (i % 2 === 0 ? COL.body : COL.bodyAlt);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    drawEyes();
  }

  function drawEyes() {
    const head = snake[0];
    if (!head) return;
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const px = -dir.y;   // 垂直方向
    const py = dir.x;
    const eo = 5.5;      // 眼睛左右间距
    const fo = 4;        // 眼睛向前偏移
    [-1, 1].forEach(function (side) {
      const ex = cx + px * eo * side + dir.x * fo;
      const ey = cy + py * eo * side + dir.y * fo;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex, ey, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(ex + dir.x * 1.4, ey + dir.y * 1.4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---------- 遮罩层 ----------
  function showOverlay(title, text, blink) {
    overlayTitle.textContent = title || "";
    overlayTitle.classList.toggle("gameover", title === "GAME OVER");
    overlayText.textContent = text || "";
    overlayBlink.textContent = blink || "";
    overlayBlink.style.display = blink ? "block" : "none";
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  // ---------- 输入 ----------
  function setDir(x, y) {
    if (!started || gameOver) return;
    if (x === -dir.x && y === -dir.y) return; // 禁止直接掉头
    if (x === dir.x && y === dir.y) return;
    ensureAudio();
    sfx.turn();
    nextDir = { x: x, y: y };
  }

  document.addEventListener("keydown", function (e) {
    const k = e.key.toLowerCase();
    let handled = true;

    if (k === "arrowup" || k === "w") setDir(0, -1);
    else if (k === "arrowdown" || k === "s") setDir(0, 1);
    else if (k === "arrowleft" || k === "a") setDir(-1, 0);
    else if (k === "arrowright" || k === "d") setDir(1, 0);
    else if (k === " ") {
      if (started && gameOver) startGame();
      else if (!started) startGame();
      else togglePause();
    } else if (k === "enter") {
      if (!started || gameOver) startGame();
    } else {
      handled = false;
    }

    if (handled) e.preventDefault();
  });

  // 手机上滑动控制
  let touchStart = null;
  canvas.addEventListener("touchstart", function (e) {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  canvas.addEventListener("touchend", function (e) {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) {
      // 轻点屏幕：开始或暂停
      if (!started || gameOver) startGame();
      else togglePause();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
  }, { passive: true });

  // 按钮
  startBtn.addEventListener("click", function () { startGame(); });
  pauseBtn.addEventListener("click", function () { togglePause(); });

  soundBtn.addEventListener("click", function () {
    muted = !muted;
    localStorage.setItem("superSnakeMuted", muted ? "1" : "0");
    soundBtn.textContent = muted ? "SOUND OFF" : "SOUND ON";
    ensureAudio();
    if (!muted) sfx.start();
  });

  document.querySelectorAll(".dpad-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      const d = b.dataset.dir;
      setDir(d === "left" ? -1 : d === "right" ? 1 : 0, d === "up" ? -1 : d === "down" ? 1 : 0);
    });
  });

  // 点击遮罩层 = 开始/暂停
  overlay.addEventListener("click", function () {
    if (!started || gameOver) startGame();
    else togglePause();
  });

  // ---------- 启动 ----------
  function init() {
    soundBtn.textContent = muted ? "SOUND OFF" : "SOUND ON";
    reset();
    showOverlay("SUPER SNAKE", "经典贪吃蛇\n方向键 / WASD 控制\n吃到苹果变长，撞墙或咬到自己结束", "PRESS START");
  }

  init();
})();
