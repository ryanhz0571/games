import { findLessonById } from "./course";
import { LESSONS, type Question } from "./lessons";
import {
  levelFromXp,
  loadProgress,
  recordCompletion,
  saveProgress,
  type Progress,
} from "./progress";
import { setupPageTransitions } from "../../src/core/transition";
import { setupWellbeing } from "../../src/core/wellbeing";

// ---------- 配置 ----------
const MAX_HEARTS = 5;
const XP_PER_CORRECT = 10;
const XP_LESSON_BONUS = 20;
const GEMS_PER_LESSON = 5;

const RUN_INTERVAL_S = 2; // 两道题之间跑多久
const QUESTION_TIME_S = 12; // 每题答题时间
const CORRECT_DELAY_MS = 700; // 答对后的过场
const WRONG_DELAY_MS = 900; // 答错后的过场
const RUN_SPEED = 15; // 米/秒

const START_GAP = 30; // 初始怪物距离（场景宽度的百分比）
const MAX_GAP = 74;
const CAUGHT_GAP = 5;
const PUSH_ON_CORRECT = 9;
const APPROACH_ON_WRONG = 7;

const JUMP_VELOCITY = 470;
const GRAVITY = 1500;

// ---------- 运行时状态 ----------
let hearts = MAX_HEARTS;
let combo = 0;
let earnedXp = 0;
let questionIndex = 0;
let progress: Progress = loadProgress();
let lessonId = "number-negative";
let questions: Question[] = [];

type Phase = "run" | "quiz" | "over";
let phase: Phase = "run";
let locked = false;

let runElapsed = 0;
let quizTimeLeft = QUESTION_TIME_S;
let distanceM = 0;
let gap = START_GAP;
let scrollX = 0;
let timeAcc = 0;
let runPhase = 0;

let jumpY = 0;
let jumpV = 0;
let dustTimer = 0;

let shake = 0;
let dashT = 0;
let hurtFlash = 0;

let choiceValue: string | null = null;
let numberlineValue = 0;
let orderPool: string[] = [];
let orderChosen: string[] = [];

// ---------- 小工具 ----------
function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) {
    throw new Error(`找不到元素：${selector}`);
  }
  return node;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setText(selector: string, value: string | number): void {
  $(selector).textContent = String(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function valueToPercent(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function threat(): number {
  return clamp((START_GAP - gap) / (START_GAP - CAUGHT_GAP), 0, 1);
}

function formatAnswer(q: Question): string {
  switch (q.type) {
    case "truefalse":
      return q.answer === true ? "对" : "错";
    case "order":
      return (q.answer as string[]).join(" < ");
    default:
      return String(q.answer);
  }
}

// ---------- 画布 ----------
const stage = $(".runner-stage");
const canvas = $<HTMLCanvasElement>("#gameCanvas");

function createContext(): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建画布上下文");
  }
  return context;
}

const ctx = createContext();
const jumpBtn = $<HTMLButtonElement>("#jumpBtn");

let W = 1;
let H = 1;
let groundY = 0;
let groundH = 0;
let charSize = 60;

function resize(): void {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(1, Math.round(rect.width));
  H = Math.max(1, Math.round(rect.height));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  groundH = clamp(H * 0.24, 54, 150);
  groundY = H - groundH;
  charSize = clamp(H * 0.2, 38, 110);
}

// 任天堂风格：粗黑描边 + 平涂色块
function outline(width: number): void {
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

// ---------- 粒子 ----------
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

const particles: Particle[] = [];

function spawnParticles(
  x: number,
  y: number,
  count: number,
  options: {
    colors: string[];
    speed: number;
    spread: number;
    angle?: number;
    size?: number;
    life?: number;
    gravity?: number;
  },
): void {
  const baseAngle = options.angle ?? -Math.PI / 2;
  for (let i = 0; i < count; i += 1) {
    const angle = baseAngle + (Math.random() - 0.5) * options.spread;
    const speed = options.speed * (0.55 + Math.random() * 0.7);
    const life = (options.life ?? 0.7) * (0.7 + Math.random() * 0.6);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      max: life,
      size: (options.size ?? 5) * (0.7 + Math.random() * 0.7),
      color: options.colors[Math.floor(Math.random() * options.colors.length)],
      gravity: options.gravity ?? 900,
    });
  }
}

function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function drawParticles(): void {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.max);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- 背景 ----------
interface Cloud {
  x: number;
  y: number;
  s: number;
  sp: number;
}

const CLOUDS: Cloud[] = [
  { x: 0.14, y: 0.16, s: 1, sp: 0.04 },
  { x: 0.52, y: 0.28, s: 0.72, sp: 0.07 },
  { x: 0.84, y: 0.12, s: 0.88, sp: 0.03 },
  { x: 0.34, y: 0.44, s: 0.55, sp: 0.1 },
];

function drawCloud(x: number, y: number, r: number): void {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.arc(x + r * 0.7, y + r * 0.1, r * 0.5, 0, Math.PI * 2);
  ctx.arc(x - r * 0.7, y + r * 0.12, r * 0.45, 0, Math.PI * 2);
  ctx.arc(x + r * 0.1, y - r * 0.32, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  outline(Math.max(2, r * 0.09));
}

function drawClouds(): void {
  const span = W + 260;
  for (const cloud of CLOUDS) {
    let x = (cloud.x * W - scrollX * cloud.sp) % span;
    if (x < -130) x += span;
    drawCloud(x, H * cloud.y, 44 * cloud.s);
  }
}

function drawSun(): void {
  const x = W * 0.82;
  const y = H * 0.17;
  const r = clamp(H * 0.06, 24, 56);
  const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.6);
  glow.addColorStop(0, "rgba(255, 236, 150, 0.85)");
  glow.addColorStop(1, "rgba(255, 236, 150, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  outline(Math.max(2, r * 0.08));
}

function drawMountains(): void {
  const baseY = groundY + 4;
  const step = Math.max(220, W * 0.3);
  const height = clamp(H * 0.24, 70, 190);
  const offset = (((scrollX * 0.12) % step) + step) % step;

  for (let x = -offset - step; x < W + step; x += step) {
    ctx.fillStyle = "#a9d8fb";
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + step * 0.5, baseY - height);
    ctx.lineTo(x + step, baseY);
    ctx.closePath();
    ctx.fill();
    outline(Math.max(2, H * 0.006));

    ctx.fillStyle = "#eef7ff";
    ctx.beginPath();
    ctx.moveTo(x + step * 0.5, baseY - height);
    ctx.lineTo(x + step * 0.5 - step * 0.11, baseY - height * 0.66);
    ctx.lineTo(x + step * 0.5 + step * 0.02, baseY - height * 0.74);
    ctx.lineTo(x + step * 0.5 + step * 0.12, baseY - height * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHills(): void {
  const baseY = groundY + 8;
  const step = Math.max(180, W * 0.24);
  const ry = clamp(H * 0.11, 30, 90);
  const offset = (((scrollX * 0.3) % step) + step) % step;

  for (let x = -offset - step; x < W + step; x += step) {
    ctx.fillStyle = "#8ce39a";
    ctx.beginPath();
    ctx.ellipse(x + step * 0.5, baseY, step * 0.62, ry, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = Math.max(2, H * 0.005);
    ctx.stroke();
  }
}

function drawGround(): void {
  ctx.fillStyle = "#67e06a";
  ctx.fillRect(0, groundY, W, 12);
  ctx.fillStyle = "#3fbf4a";
  ctx.fillRect(0, groundY + 12, W, 5);

  const grad = ctx.createLinearGradient(0, groundY + 17, 0, H);
  grad.addColorStop(0, "#c84c0c");
  grad.addColorStop(1, "#8a3410");
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY + 17, W, H - groundY - 17);

  const step = 72;
  const offset = ((scrollX % step) + step) % step;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let x = -offset; x < W + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 34);
    ctx.lineTo(x + 30, groundY + 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 40, groundY + 58);
    ctx.lineTo(x + 60, groundY + 58);
    ctx.stroke();
  }
}

function drawNearLayer(): void {
  const step = 168;
  const offset = (((scrollX * 0.7) % step) + step) % step;
  const ol = Math.max(2, H * 0.006);

  for (let x = -offset - step; x < W + step; x += step) {
    const r = 22;
    ctx.fillStyle = "#2fae4a";
    ctx.beginPath();
    ctx.ellipse(x + 34, groundY - r * 0.7, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ol);
    ctx.beginPath();
    ctx.ellipse(x + 54, groundY - r * 0.5, r * 0.66, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ol);

    ctx.fillStyle = "#c9b79a";
    ctx.beginPath();
    ctx.ellipse(x + 120, groundY - 8, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ol);
  }
}

function drawSpeedLines(): void {
  if (dashT <= 0) return;
  const alpha = clamp(dashT, 0, 1) * 0.7;
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 9; i += 1) {
    const y = 24 + (i / 9) * (groundY - 40);
    const x = ((timeAcc * 1200 + i * 170) % (W + 260)) - 130;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 80, y);
    ctx.stroke();
  }
}

// ---------- 主角（任天堂风格） ----------
function drawFox(cx: number, feetY: number, size: number, running: boolean): void {
  const s = size;
  const airborne = jumpY > 0;
  const hop = running && !airborne ? Math.abs(Math.sin(runPhase * 2)) * s * 0.09 : 0;
  const ol = Math.max(2, s * 0.05);

  ctx.save();
  ctx.translate(cx, feetY + hop);
  if (airborne) ctx.rotate(-0.12);

  const bodyY = -s * 0.5;

  // 腿：先粗黑描边，再叠橙色
  const hips = [-0.24, -0.04, 0.16, 0.32];
  for (let pass = 0; pass < 2; pass += 1) {
    ctx.lineCap = "round";
    ctx.lineWidth = pass === 0 ? s * 0.2 : s * 0.1;
    ctx.strokeStyle = pass === 0 ? "#2b2b2b" : "#ff9a3c";
    for (let i = 0; i < hips.length; i += 1) {
      const hipX = hips[i] * s;
      const swing = airborne ? 0.7 : Math.sin(runPhase * 2.4 + i * 1.6) * 0.9;
      const footX = hipX + swing * s * 0.18;
      const footY = airborne ? bodyY + s * 0.22 : 0;
      ctx.beginPath();
      ctx.moveTo(hipX, bodyY + s * 0.2);
      ctx.lineTo(footX, footY);
      ctx.stroke();
    }
  }

  // 尾巴
  ctx.save();
  ctx.translate(-s * 0.4, bodyY - s * 0.02);
  ctx.rotate(-0.5 + Math.sin(runPhase * 1.8) * 0.14);
  ctx.beginPath();
  ctx.ellipse(-s * 0.36, 0, s * 0.42, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ff9a3c";
  ctx.fill();
  outline(ol);
  ctx.beginPath();
  ctx.ellipse(-s * 0.68, 0, s * 0.17, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff6ea";
  ctx.fill();
  outline(ol);
  ctx.restore();

  // 身体
  ctx.beginPath();
  ctx.ellipse(0, bodyY, s * 0.44, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ff9a3c";
  ctx.fill();
  outline(ol);
  ctx.beginPath();
  ctx.ellipse(s * 0.06, bodyY + s * 0.13, s * 0.26, s * 0.17, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff6ea";
  ctx.fill();

  // 耳朵
  const headX = s * 0.46;
  const headY = bodyY - s * 0.36;
  ctx.beginPath();
  ctx.moveTo(headX - s * 0.26, headY - s * 0.16);
  ctx.lineTo(headX - s * 0.18, headY - s * 0.64);
  ctx.lineTo(headX + s * 0.06, headY - s * 0.24);
  ctx.closePath();
  ctx.fillStyle = "#ff9a3c";
  ctx.fill();
  outline(ol);
  ctx.beginPath();
  ctx.moveTo(headX + s * 0.06, headY - s * 0.24);
  ctx.lineTo(headX + s * 0.26, headY - s * 0.62);
  ctx.lineTo(headX + s * 0.32, headY - s * 0.12);
  ctx.closePath();
  ctx.fill();
  outline(ol);

  // 头
  ctx.beginPath();
  ctx.arc(headX, headY, s * 0.37, 0, Math.PI * 2);
  ctx.fillStyle = "#ffab5e";
  ctx.fill();
  outline(ol);

  // 口鼻
  ctx.beginPath();
  ctx.ellipse(headX + s * 0.3, headY + s * 0.13, s * 0.2, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff6ea";
  ctx.fill();
  outline(ol);

  // 大眼睛
  for (const ex of [headX + s * 0.04, headX + s * 0.32]) {
    ctx.beginPath();
    ctx.arc(ex, headY - s * 0.07, s * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    outline(ol * 0.8);
    ctx.beginPath();
    ctx.arc(ex + s * 0.035, headY - s * 0.06, s * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = "#2b2b2b";
    ctx.fill();
  }

  // 鼻子
  ctx.beginPath();
  ctx.arc(headX + s * 0.46, headY + s * 0.07, s * 0.065, 0, Math.PI * 2);
  ctx.fillStyle = "#2b2b2b";
  ctx.fill();

  // 红围巾
  ctx.beginPath();
  ctx.moveTo(headX - s * 0.26, headY + s * 0.22);
  ctx.quadraticCurveTo(
    headX - s * 0.86,
    headY + s * 0.08 + Math.sin(runPhase * 2) * s * 0.12,
    headX - s * 1.16,
    headY + s * 0.42 + Math.sin(runPhase * 2) * s * 0.2,
  );
  ctx.lineCap = "round";
  ctx.lineWidth = s * 0.15;
  ctx.strokeStyle = "#2b2b2b";
  ctx.stroke();
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = "#e52521";
  ctx.stroke();

  ctx.restore();
}

// ---------- 怪物（任天堂风格） ----------
function drawMonster(cx: number, feetY: number, size: number, danger: number): void {
  const s = size * (1 + danger * 0.38);
  const bob = Math.sin(runPhase * 2.6) * s * 0.06;
  const ol = Math.max(2, s * 0.05);

  ctx.save();
  ctx.translate(cx, feetY + bob);

  // 脚
  for (const dx of [-0.28, 0.28]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, -s * 0.07, s * 0.17, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#4a2472";
    ctx.fill();
    outline(ol);
  }

  // 身体
  const body = ctx.createRadialGradient(
    -s * 0.1,
    -s * 0.82,
    s * 0.08,
    0,
    -s * 0.6,
    s * 0.66,
  );
  body.addColorStop(0, "#c489f0");
  body.addColorStop(1, "#7b2fb0");
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.6, s * 0.54, s * 0.52, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  outline(ol);

  // 大眼睛
  for (const ex of [-0.2, 0.2]) {
    ctx.beginPath();
    ctx.arc(ex * s, -s * 0.74, s * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    outline(ol * 0.8);
    ctx.beginPath();
    ctx.arc(ex * s + s * 0.03, -s * 0.74, s * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = "#2b2b2b";
    ctx.fill();
  }

  // 眉毛
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(-s * 0.36, -s * 0.95);
  ctx.lineTo(-s * 0.08, -s * 0.87);
  ctx.moveTo(s * 0.36, -s * 0.95);
  ctx.lineTo(s * 0.08, -s * 0.87);
  ctx.stroke();

  // 嘴
  ctx.beginPath();
  ctx.arc(0, -s * 0.44, s * 0.2, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.lineWidth = s * 0.07;
  ctx.stroke();

  // 牙
  ctx.fillStyle = "#ffffff";
  for (const dx of [-0.08, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(dx * s - s * 0.035, -s * 0.36);
    ctx.lineTo(dx * s + s * 0.035, -s * 0.36);
    ctx.lineTo(dx * s, -s * 0.27);
    ctx.closePath();
    ctx.fill();
    outline(ol * 0.6);
  }

  // 逼近时的红光
  if (danger > 0.4) {
    ctx.globalAlpha = (danger - 0.4) * 0.9;
    const glow = ctx.createRadialGradient(
      0,
      -s * 0.56,
      s * 0.2,
      0,
      -s * 0.56,
      s * 0.95,
    );
    glow.addColorStop(0, "rgba(255, 70, 70, 0.65)");
    glow.addColorStop(1, "rgba(255, 70, 70, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -s * 0.56, s * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function foxCenter(): { x: number; y: number } {
  const feetY = groundY + 10;
  const hop = jumpY > 0 ? 0 : Math.abs(Math.sin(runPhase * 2)) * charSize * 0.09;
  return { x: W * 0.5, y: feetY - jumpY - hop - charSize * 0.55 };
}

function drawCharacters(): void {
  const feetY = groundY + 10;
  const foxX = W * 0.5;
  const monsterX = foxX - (gap / 100) * W;
  const running = phase === "run" && !wellbeing.isResting();

  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.beginPath();
  ctx.ellipse(foxX, feetY, charSize * 0.42, charSize * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(monsterX, feetY, charSize * 0.38, charSize * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  drawMonster(monsterX, feetY, charSize * 0.95, threat());
  drawFox(foxX, feetY, charSize, running);
}

function drawVignette(): void {
  const danger = threat();
  const red = hurtFlash > 0 ? hurtFlash : 0;
  if (danger <= 0.3 && red <= 0) return;

  const alpha = clamp((danger - 0.3) / 0.7, 0, 1) * 0.45 + red;
  const grad = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.28,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.72,
  );
  grad.addColorStop(0, "rgba(220, 20, 40, 0)");
  grad.addColorStop(1, `rgba(200, 20, 40, ${Math.min(alpha, 0.75).toFixed(3)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function draw(): void {
  ctx.clearRect(0, 0, W, H);

  let sx = 0;
  let sy = 0;
  if (shake > 0.2) {
    sx = (Math.random() - 0.5) * shake;
    sy = (Math.random() - 0.5) * shake;
  }

  ctx.save();
  ctx.translate(sx, sy);
  drawSun();
  drawClouds();
  drawMountains();
  drawHills();
  drawGround();
  drawNearLayer();
  drawSpeedLines();
  drawCharacters();
  drawParticles();
  ctx.restore();

  drawVignette();
}

// ---------- HUD ----------
function renderStats(): void {
  setText("#streak", progress.streak);
  setText("#hearts", hearts);
  setText("#level", `Lv.${levelFromXp(progress.xp).level}`);
  setText("#xp", progress.xp);
  setText("#gems", progress.gems);
}

function renderMeters(): void {
  setText("#distance", `${Math.floor(distanceM)} m`);
  $("#dangerBar").style.width = `${(threat() * 100).toFixed(1)}%`;
}

function updateNextLabel(): void {
  const label = $("#nextQuestion");
  if (phase === "run") {
    const left = Math.max(0, RUN_INTERVAL_S - runElapsed / 1000);
    label.textContent = `下一题 ${Math.ceil(left)} 秒`;
  } else if (phase === "quiz") {
    label.textContent = locked ? "下一题…" : "答题中…";
  } else {
    label.textContent = "";
  }
}

let lastJumpDisabled = false;
function updateControls(): void {
  const disabled = phase !== "run";
  if (disabled !== lastJumpDisabled) {
    lastJumpDisabled = disabled;
    jumpBtn.disabled = disabled;
  }
}

function updateQuizCountdown(): void {
  setText("#questionCountdown", `${Math.ceil(Math.max(0, quizTimeLeft))} 秒`);
}

// ---------- 轻提示 / 浮层 ----------
let toastTimer = 0;

function showToast(
  text: string,
  kind?: "correct" | "wrong",
  duration = 1700,
): void {
  const toast = $("#toast");
  toast.textContent = text;
  toast.className = `toast${kind ? ` ${kind}` : ""}`;
  toast.hidden = false;
  void toast.offsetWidth;
  toast.classList.add("show");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, duration);
}

function showOverlay(card: HTMLElement): void {
  const overlay = $("#overlay");
  overlay.innerHTML = "";
  overlay.append(card);
  overlay.hidden = false;
}

function hideOverlay(): void {
  const overlay = $("#overlay");
  overlay.innerHTML = "";
  overlay.hidden = true;
}

function flashModal(): void {
  const card = document.querySelector<HTMLElement>(".question-card-runner");
  if (!card) return;
  card.classList.remove("shake");
  void card.offsetWidth;
  card.classList.add("shake");
}

// ---------- 题目渲染 ----------
function buildAnswerArea(q: Question): HTMLElement {
  switch (q.type) {
    case "choice":
      return buildChoice(q);
    case "truefalse":
      return buildTrueFalse();
    case "numberline":
      return buildNumberLine(q);
    case "input":
      return buildInput();
    case "order":
      return buildOrder();
  }
}

function buildChoice(q: Question): HTMLElement {
  const wrap = el("div", "runner-choices");
  for (const value of q.choices ?? []) {
    const button = el("button", "runner-choice", value);
    button.type = "button";
    button.dataset.value = value;
    button.addEventListener("click", () => {
      choiceValue = value;
      submitAnswer();
    });
    wrap.append(button);
  }
  return wrap;
}

function buildTrueFalse(): HTMLElement {
  const wrap = el("div", "runner-choices");
  const options: Array<[string, string]> = [
    ["true", "对"],
    ["false", "错"],
  ];
  for (const [value, label] of options) {
    const button = el("button", "runner-choice", label);
    button.type = "button";
    button.dataset.value = value;
    button.addEventListener("click", () => {
      choiceValue = value;
      submitAnswer();
    });
    wrap.append(button);
  }
  return wrap;
}

function buildInput(): HTMLElement {
  const wrap = el("div", "runner-input-row");
  const input = el("input", "runner-input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.placeholder = "输入答案";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitAnswer();
  });

  const button = el("button", "runner-submit", "检查");
  button.type = "button";
  button.addEventListener("click", () => submitAnswer());

  wrap.append(input, button);
  window.setTimeout(() => input.focus(), 80);
  return wrap;
}

function buildNumberLine(q: Question): HTMLElement {
  const wrap = el("div", "numberline");
  const scale = el("div", "numberline-scale");
  const min = q.min ?? -5;
  const max = q.max ?? 5;

  for (let value = min; value <= max; value += 1) {
    const tick = el("div", "numberline-tick");
    tick.style.left = `${valueToPercent(value, min, max)}%`;
    tick.append(el("span", "numberline-tick-label", String(value)));
    scale.append(tick);
  }

  const handle = el("div", "numberline-handle");
  const bubble = el("div", "numberline-bubble", String(numberlineValue));
  scale.append(handle, bubble);

  let dragging = false;

  const update = (): void => {
    const percent = valueToPercent(numberlineValue, min, max);
    handle.style.left = `${percent}%`;
    bubble.style.left = `${percent}%`;
    bubble.textContent = String(numberlineValue);
  };

  const setFromClientX = (clientX: number): void => {
    const rect = scale.getBoundingClientRect();
    const t = clamp((clientX - rect.left) / rect.width, 0, 1);
    numberlineValue = Math.round(min + t * (max - min));
    update();
  };

  scale.addEventListener("pointerdown", (event) => {
    dragging = true;
    scale.setPointerCapture(event.pointerId);
    setFromClientX(event.clientX);
  });
  scale.addEventListener("pointermove", (event) => {
    if (dragging) setFromClientX(event.clientX);
  });
  scale.addEventListener("pointerup", () => {
    dragging = false;
  });
  scale.addEventListener("pointercancel", () => {
    dragging = false;
  });

  update();

  const actions = el("div", "runner-input-row");
  const button = el("button", "runner-submit", "检查");
  button.type = "button";
  button.addEventListener("click", () => submitAnswer());
  actions.append(button);

  wrap.append(scale, actions);
  return wrap;
}

function buildOrder(): HTMLElement {
  const wrap = el("div", "order");
  const chosen = el("div", "order-chosen");
  const pool = el("div", "order-pool");
  wrap.append(chosen, pool);
  renderOrder(chosen, pool);

  const actions = el("div", "runner-input-row");
  const button = el("button", "runner-submit", "检查");
  button.type = "button";
  button.addEventListener("click", () => submitAnswer());
  actions.append(button);
  wrap.append(actions);
  return wrap;
}

function renderOrder(chosenEl: HTMLElement, poolEl: HTMLElement): void {
  chosenEl.innerHTML = "";
  poolEl.innerHTML = "";

  orderChosen.forEach((item, index) => {
    const chip = el("button", "order-chip chosen", `${index + 1}. ${item}`);
    chip.type = "button";
    chip.addEventListener("click", () => {
      const at = orderChosen.indexOf(item);
      if (at >= 0) {
        orderChosen.splice(at, 1);
        orderPool.push(item);
      }
      renderOrder(chosenEl, poolEl);
    });
    chosenEl.append(chip);
  });

  orderPool.forEach((item) => {
    const chip = el("button", "order-chip", item);
    chip.type = "button";
    chip.addEventListener("click", () => {
      const at = orderPool.indexOf(item);
      if (at >= 0) {
        orderPool.splice(at, 1);
        orderChosen.push(item);
      }
      renderOrder(chosenEl, poolEl);
    });
    poolEl.append(chip);
  });
}

function renderQuestion(): void {
  const q = questions[questionIndex];
  if (!q) {
    victory();
    return;
  }

  choiceValue = null;
  numberlineValue = 0;
  orderPool = [...(q.items ?? [])];
  orderChosen = [];

  setText("#questionPrompt", q.prompt);
  const body = $("#questionBody");
  body.innerHTML = "";
  body.append(buildAnswerArea(q));
}

// ---------- 判定 ----------
function checkAnswer(q: Question): boolean | undefined {
  switch (q.type) {
    case "choice":
    case "truefalse":
      return choiceValue === null ? undefined : choiceValue === String(q.answer);
    case "numberline":
      return Math.abs(numberlineValue - Number(q.answer)) <= (q.tolerance ?? 0.5);
    case "input": {
      const input = document.querySelector<HTMLInputElement>(".runner-input");
      return input ? Number(input.value.trim()) === Number(q.answer) : undefined;
    }
    case "order":
      return JSON.stringify(orderChosen) === JSON.stringify(q.answer);
  }
}

function submitAnswer(): void {
  if (phase !== "quiz" || locked || wellbeing.isResting()) return;

  const q = questions[questionIndex];
  if (!q) return;

  const result = checkAnswer(q);
  if (result === undefined) {
    flashModal();
    return;
  }

  if (result) {
    onCorrect(q);
  } else {
    onWrong(q);
  }
}

// 答完一题后，最多 3 秒（过场 + 跑动）就出下一题
function scheduleAdvance(delayMs: number): void {
  window.setTimeout(() => {
    if (phase !== "quiz") return;
    if (questionIndex >= questions.length) {
      victory();
    } else {
      phase = "run";
      runElapsed = 0;
      locked = false;
    }
  }, delayMs);
}

function onCorrect(q: Question): void {
  locked = true;
  combo += 1;
  earnedXp += XP_PER_CORRECT;
  progress.xp += XP_PER_CORRECT;
  saveProgress(progress);

  gap = Math.min(MAX_GAP, gap + PUSH_ON_CORRECT);
  distanceM += 20;
  questionIndex += 1;

  const fox = foxCenter();
  spawnParticles(fox.x, fox.y, 16, {
    colors: ["#ffd900", "#ffb703", "#fff3b0", "#58cc02"],
    speed: 320,
    spread: Math.PI * 1.2,
    size: 7,
    life: 0.8,
    gravity: 700,
  });
  dashT = 0.8;

  renderStats();
  renderMeters();
  $("#questionModal").hidden = true;
  const prefix = combo > 1 ? `✓ 连击 x${combo}！` : "✓ 答对了！";
  showToast(`${prefix}${q.explain}`, "correct", 1800);
  scheduleAdvance(CORRECT_DELAY_MS);
}

function onWrong(q: Question): void {
  locked = true;
  combo = 0;
  hearts -= 1;
  gap = Math.max(0, gap - APPROACH_ON_WRONG);
  shake = 16;
  hurtFlash = 0.55;

  const fox = foxCenter();
  spawnParticles(fox.x, fox.y, 14, {
    colors: ["#ff4b4b", "#ff9600", "#3b2f2f"],
    speed: 260,
    spread: Math.PI * 1.4,
    size: 6,
    life: 0.6,
    gravity: 1100,
  });

  questionIndex += 1;
  renderStats();
  renderMeters();

  if (hearts <= 0 || gap <= CAUGHT_GAP) {
    gameOver();
    return;
  }

  $("#questionModal").hidden = true;
  showToast(`❌ 正确答案：${formatAnswer(q)} · ${q.explain}`, "wrong", 2400);
  scheduleAdvance(WRONG_DELAY_MS);
}

function handleTimeout(): void {
  if (phase !== "quiz") return;
  const q = questions[questionIndex];
  if (q) onWrong(q);
}

function openQuestion(): void {
  if (questionIndex >= questions.length) {
    victory();
    return;
  }
  phase = "quiz";
  quizTimeLeft = QUESTION_TIME_S;
  locked = false;
  renderQuestion();
  $("#questionModal").hidden = false;
  updateQuizCountdown();
}

// ---------- 结束 ----------
function victory(): void {
  phase = "over";
  $("#questionModal").hidden = true;

  const levelBefore = levelFromXp(progress.xp).level;
  progress = recordCompletion(lessonId, XP_LESSON_BONUS, GEMS_PER_LESSON);
  earnedXp += XP_LESSON_BONUS;
  const levelAfter = levelFromXp(progress.xp).level;
  renderStats();

  const card = el("div", "overlay-card");
  card.append(el("div", "overlay-emoji", "🏁"));
  card.append(el("h2", "overlay-title", "跑酷完成！"));
  card.append(
    el(
      "p",
      "overlay-text",
      `跑了 ${Math.floor(distanceM)} 米，获得 ${earnedXp} 分、${GEMS_PER_LESSON} 枚金币`,
    ),
  );
  if (levelAfter > levelBefore) {
    card.append(el("p", "overlay-streak", `🎖️ 升级到 Lv.${levelAfter}`));
  }
  card.append(el("p", "overlay-streak", `🔥 连续打卡 ${progress.streak} 天`));

  const again = el("button", "btn-primary", "再跑一次");
  again.type = "button";
  again.addEventListener("click", () => {
    hideOverlay();
    resetGame();
  });
  const back = el("a", "btn-ghost", "返回学习大厅");
  back.href = "../";
  card.append(again, back);
  showOverlay(card);
}

function gameOver(): void {
  phase = "over";
  $("#questionModal").hidden = true;
  const caught = gap <= CAUGHT_GAP;

  const card = el("div", "overlay-card");
  card.append(el("div", "overlay-emoji", caught ? "👾" : "💔"));
  card.append(
    el("h2", "overlay-title", caught ? "被怪物追上了！" : "生命用完了"),
  );
  card.append(
    el("p", "overlay-text", `这次跑了 ${Math.floor(distanceM)} 米，再接再厉！`),
  );

  const retry = el("button", "btn-primary", "重新开始");
  retry.type = "button";
  retry.addEventListener("click", () => {
    hideOverlay();
    resetGame();
  });
  const back = el("a", "btn-ghost", "返回学习大厅");
  back.href = "../";
  card.append(retry, back);
  showOverlay(card);
}

function resetGame(): void {
  hearts = MAX_HEARTS;
  combo = 0;
  earnedXp = 0;
  questionIndex = 0;
  distanceM = 0;
  gap = START_GAP;
  runElapsed = 0;
  quizTimeLeft = QUESTION_TIME_S;
  jumpY = 0;
  jumpV = 0;
  shake = 0;
  dashT = 0;
  hurtFlash = 0;
  particles.length = 0;
  locked = false;
  phase = "run";
  $("#questionModal").hidden = true;
  renderStats();
  renderMeters();
}

// ---------- 跳跃 ----------
function jump(): void {
  if (phase !== "run" || wellbeing.isResting()) return;
  if (jumpY > 0 || jumpV !== 0) return;
  jumpV = JUMP_VELOCITY;
  distanceM += 2;
  const fox = foxCenter();
  spawnParticles(fox.x, groundY + 10, 10, {
    colors: ["#ffffff", "#d9f2ff", "#c9e8ff"],
    speed: 170,
    spread: Math.PI * 1.1,
    size: 5,
    life: 0.5,
    gravity: 500,
  });
}

// ---------- 主循环 ----------
function update(dt: number): void {
  const resting = wellbeing.isResting();
  const running = phase === "run" && !resting;
  const quizzing = phase === "quiz" && !resting && !locked;

  if (running || quizzing) {
    timeAcc += dt;
  }
  if (running) {
    runPhase += dt * 13;
  }

  if (running && (jumpY > 0 || jumpV !== 0)) {
    jumpV -= GRAVITY * dt;
    jumpY += jumpV * dt;
    if (jumpY <= 0) {
      jumpY = 0;
      jumpV = 0;
    }
  }

  if (running) {
    runElapsed += dt * 1000;
    distanceM += RUN_SPEED * dt;
    scrollX += (RUN_SPEED + (dashT > 0 ? 46 : 0)) * dt * 9;

    dustTimer -= dt;
    if (dustTimer <= 0) {
      dustTimer = 0.07;
      spawnParticles(W * 0.5 - charSize * 0.35, groundY + 12, 2, {
        colors: ["#e8d6c0", "#cbb69c", "#ffffff"],
        speed: 120,
        spread: Math.PI * 0.8,
        angle: Math.PI * 0.15,
        size: 4,
        life: 0.45,
        gravity: 300,
      });
    }

    if (runElapsed >= RUN_INTERVAL_S * 1000) {
      openQuestion();
    }
  } else if (quizzing) {
    quizTimeLeft -= dt;
    if (quizTimeLeft <= 0) {
      handleTimeout();
    } else {
      updateQuizCountdown();
    }
  }

  updateParticles(dt);
  shake = Math.max(0, shake - dt * 60);
  dashT = Math.max(0, dashT - dt);
  hurtFlash = Math.max(0, hurtFlash - dt * 1.4);

  updateNextLabel();
  renderMeters();
  updateControls();
}

let lastTs = 0;
function frame(ts: number): void {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  update(dt);
  draw();
  window.requestAnimationFrame(frame);
}

// ---------- 启动 ----------
function resolveLesson(): void {
  const params = new URLSearchParams(window.location.search);
  lessonId = params.get("lesson") ?? "number-negative";
  questions = LESSONS[lessonId] ?? [];
}

const wellbeing = setupWellbeing({
  page: "game",
  gameName: "数字大陆跑酷",
});

function init(): void {
  setupPageTransitions();
  resolveLesson();

  resize();
  window.addEventListener("resize", resize);

  canvas.addEventListener("pointerdown", jump);
  jumpBtn.addEventListener("click", jump);
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      const target = event.target as HTMLElement | null;
      if (target && target.tagName === "INPUT") return;
      event.preventDefault();
      jump();
    }
  });

  renderStats();
  renderMeters();
  updateNextLabel();
  updateControls();

  if (questions.length === 0) {
    phase = "over";
    const card = el("div", "overlay-card");
    card.append(el("div", "overlay-emoji", "🚧"));
    card.append(el("h2", "overlay-title", "这个关卡即将开放"));
    card.append(el("p", "overlay-text", "完成前面的关卡，就能解锁这里。"));
    const back = el("a", "btn-ghost", "返回学习大厅");
    back.href = "../";
    card.append(back);
    showOverlay(card);
  } else if (findLessonById(lessonId)) {
    showToast("开始跑酷！答对甩开怪物，答错会被追上", undefined, 3000);
  }

  window.requestAnimationFrame(frame);
}

init();
