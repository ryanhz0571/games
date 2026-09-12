import { findLessonById } from "./course";
import {
  levelFromXp,
  loadProgress,
  recordCompletion,
  saveProgress,
  type Progress,
} from "./progress";
import { setupPageTransitions } from "../../src/core/transition";
import {
  setupWellbeing,
  type WellbeingController,
} from "../../src/core/wellbeing";

// ---------- 类型 ----------
type QuestionType = "choice" | "numberline" | "input" | "truefalse" | "order";
type Answer = string | number | boolean | string[];

interface Question {
  type: QuestionType;
  prompt: string;
  hint: string;
  explain: string;
  choices?: string[];
  min?: number;
  max?: number;
  tolerance?: number;
  unit?: string;
  items?: string[];
  answer: Answer;
}

// ---------- 配置 ----------
const MAX_HEARTS = 5;
const XP_PER_CORRECT = 10;
const XP_LESSON_BONUS = 20;
const GEMS_PER_LESSON = 5;

const LESSONS: Record<string, Question[]> = {
  "number-negative": [
  {
    type: "choice",
    prompt: "杭州今天零下 3℃，这个温度应该记作哪个数？",
    hint: "比 0 更低的温度，要用什么样的符号来表示？",
    explain: "零下 3℃ 表示比 0 低 3，用负号“−”表示，所以记作 −3。",
    choices: ["3", "−3", "0"],
    answer: "−3",
  },
  {
    type: "numberline",
    prompt: "把 −2 拖到数轴上正确的位置。",
    hint: "从 0 出发，往左走 2 格就是 −2。",
    explain: "负数在数轴上位于 0 的左边，−2 在 0 左边第 2 格。",
    min: -5,
    max: 5,
    tolerance: 0.5,
    answer: -2,
  },
  {
    type: "choice",
    prompt: "“还差 200 元才能还清”，这笔钱应该记作？",
    hint: "欠的钱和“多出来的钱”，方向是相反的。",
    explain: "欠 200 元表示少了 200，所以记作 −200。",
    choices: ["+200", "−200", "200"],
    answer: "−200",
  },
  {
    type: "input",
    prompt: "电梯从 1 楼到地下一层，一共走了几层？",
    hint: "地下一层就是 −1 层，从 1 到 −1 经过了几层？",
    explain: "从 1 到 0 是一层，从 0 到 −1 又是一层，所以一共 2 层。",
    unit: "层",
    answer: 2,
  },
  {
    type: "truefalse",
    prompt: "−2 比 −5 大。",
    hint: "在数轴上，越靠右的数越大。−2 和 −5 谁更靠右？",
    explain: "−2 在 −5 的右边，所以 −2 比 −5 大。",
    answer: true,
  },
  {
    type: "order",
    prompt: "把这些数从小到大排好。",
    hint: "数轴上从左到右，就是从“小”到“大”。",
    explain: "在数轴上从左到右依次是 −5、−3、0、2，所以 −5 < −3 < 0 < 2。",
    items: ["0", "−3", "2", "−5"],
    answer: ["−5", "−3", "0", "2"],
  },
  ],
  "number-axis": [
    {
      type: "choice",
      prompt: "在数轴上，3 的相反数是哪个数？",
      hint: "相反数就是方向相反、到 0 距离一样的数。",
      explain: "3 的相反数是 −3，它们在数轴上位于 0 的两侧、距离相等。",
      choices: ["3", "−3", "0"],
      answer: "−3",
    },
    {
      type: "numberline",
      prompt: "把 −4 的相反数拖到数轴上正确的位置。",
      hint: "先想 −4 的相反数是多少，再把它拖到数轴上。",
      explain: "−4 的相反数是 4，它在 0 右边第 4 格。",
      min: -5,
      max: 5,
      tolerance: 0.5,
      answer: 4,
    },
    {
      type: "choice",
      prompt: "−(−5) 等于多少？",
      hint: "一个数前面再加一个负号，就变成了它的相反数。",
      explain: "−5 的相反数是 5，所以 −(−5) = 5。",
      choices: ["−5", "5", "0"],
      answer: "5",
    },
    {
      type: "input",
      prompt: "−7 的相反数是几？",
      hint: "相反数到 0 的距离一样，只是方向相反。",
      explain: "−7 的相反数是 7。",
      answer: 7,
    },
    {
      type: "truefalse",
      prompt: "0 的相反数还是 0。",
      hint: "0 既不是正数也不是负数，它到原点的距离是 0。",
      explain: "0 的相反数就是 0。",
      answer: true,
    },
  ],
};

// ---------- 运行时状态 ----------
let hearts = MAX_HEARTS;
let combo = 0;
let earnedXp = 0;
let questionIndex = 0;
let locked = false;
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

let progress: Progress = loadProgress();
let lessonId = "number-negative";
let questions: Question[] = [];

let numberlineValue = 0;
let orderPool: string[] = [];
let orderChosen: string[] = [];
let lockedBeforeRest: boolean | null = null;
let wellbeing: WellbeingController | null = null;

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

// ---------- HUD ----------
function renderHud(): void {
  setText("#streak", progress.streak);
  setText("#hearts", hearts);
  setText("#xp", progress.xp);
  setText("#gems", progress.gems);
}

function renderProgress(): void {
  const total = questions.length;
  const percent = total === 0 ? 0 : ((questionIndex) / total) * 100;
  $("#progressBar").style.width = `${percent}%`;
}

// ---------- 题目渲染 ----------
function renderQuestion(): void {
  const q = questions[questionIndex];

  numberlineValue = 0;
  orderPool = [...(q.items ?? [])];
  orderChosen = [];

  const lesson = $("#lesson");
  lesson.innerHTML = "";

  const card = el("div", "question-card");
  card.append(el("h2", "question-prompt", q.prompt));
  card.append(buildAnswerArea(q));
  lesson.append(card);

  setLocked(false);
  hideFeedback();
  renderProgress();
  renderHud();

  if (q.type === "input") {
    const input = $<HTMLInputElement>(".answer-input");
    window.setTimeout(() => input.focus(), 0);
  }
}

function buildAnswerArea(q: Question): HTMLElement {
  switch (q.type) {
    case "choice":
      return buildChoice(q);
    case "truefalse":
      return buildTrueFalse();
    case "numberline":
      return buildNumberLine(q);
    case "input":
      return buildInput(q);
    case "order":
      return buildOrder();
  }
}

function buildChoice(q: Question): HTMLElement {
  const wrap = el("div", "choices");
  for (const value of q.choices ?? []) {
    const button = el("button", "choice", value);
    button.type = "button";
    button.dataset.value = value;
    button.addEventListener("click", () => {
      wrap.querySelectorAll(".choice").forEach((node) => {
        node.classList.toggle("selected", node === button);
      });
    });
    wrap.append(button);
  }
  return wrap;
}

function buildTrueFalse(): HTMLElement {
  const wrap = el("div", "choices");
  const options: Array<[string, string]> = [
    ["true", "对"],
    ["false", "错"],
  ];
  for (const [value, label] of options) {
    const button = el("button", "choice", label);
    button.type = "button";
    button.dataset.value = value;
    button.addEventListener("click", () => {
      wrap.querySelectorAll(".choice").forEach((node) => {
        node.classList.toggle("selected", node === button);
      });
    });
    wrap.append(button);
  }
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
  wrap.append(scale);
  return wrap;
}

function valueToPercent(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function buildInput(q: Question): HTMLElement {
  const wrap = el("div", "input-row");
  const input = el("input", "answer-input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.placeholder = "输入数字";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
  wrap.append(input);
  if (q.unit) {
    wrap.append(el("span", "input-unit", q.unit));
  }
  return wrap;
}

function buildOrder(): HTMLElement {
  const wrap = el("div", "order");
  const chosen = el("div", "order-chosen");
  const pool = el("div", "order-pool");
  wrap.append(chosen, pool);
  renderOrder(chosen, pool);
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

// ---------- 提交与判定 ----------
function submit(): void {
  if (locked || wellbeing?.isResting()) return;

  const q = questions[questionIndex];
  const result = checkAnswer(q);

  if (result === undefined) {
    shakeCard();
    return;
  }

  setLocked(true);
  if (result) {
    onCorrect(q);
  } else {
    onWrong(q);
  }
}

function checkAnswer(q: Question): boolean | undefined {
  switch (q.type) {
    case "choice": {
      const selected = document.querySelector<HTMLElement>(".choice.selected");
      return selected ? selected.dataset.value === String(q.answer) : undefined;
    }
    case "truefalse": {
      const selected = document.querySelector<HTMLElement>(".choice.selected");
      return selected ? selected.dataset.value === String(q.answer) : undefined;
    }
    case "numberline":
      return Math.abs(numberlineValue - Number(q.answer)) <= (q.tolerance ?? 0.5);
    case "input": {
      const input = $<HTMLInputElement>(".answer-input");
      return Number(input.value.trim()) === Number(q.answer);
    }
    case "order":
      return JSON.stringify(orderChosen) === JSON.stringify(q.answer);
  }
}

function onCorrect(q: Question): void {
  combo += 1;
  earnedXp += XP_PER_CORRECT;
  progress.xp += XP_PER_CORRECT;
  saveProgress(progress);
  renderHud();

  const feedback = $("#feedback");
  feedback.innerHTML = "";
  feedback.className = "feedback show correct";
  feedback.hidden = false;
  feedback.append(el("p", "feedback-message", "✓ 答对了！"));
  if (combo > 1) {
    feedback.append(el("p", "feedback-combo", `连击 x${combo}`));
  }
  feedback.append(el("p", "feedback-explain", q.explain));

  feedbackTimer = window.setTimeout(() => {
    hideFeedback();
    advance();
  }, 1400);
}

function onWrong(q: Question): void {
  combo = 0;
  hearts -= 1;
  renderHud();

  if (hearts <= 0) {
    failLesson();
    return;
  }

  const feedback = $("#feedback");
  feedback.innerHTML = "";
  feedback.className = "feedback show wrong";
  feedback.hidden = false;
  feedback.append(el("p", "feedback-message", "🤔 再想想"));
  feedback.append(el("p", "feedback-hint", q.hint));

  const whyButton = el("button", "btn-ghost", "为什么？");
  whyButton.type = "button";
  const explain = el("div", "feedback-explain", q.explain);
  explain.hidden = true;
  whyButton.addEventListener("click", () => {
    explain.hidden = !explain.hidden;
  });

  const retry = el("button", "btn-primary", "再试一次");
  retry.type = "button";
  retry.addEventListener("click", () => {
    hideFeedback();
    renderQuestion();
  });

  feedback.append(whyButton, retry, explain);
}

function advance(): void {
  questionIndex += 1;
  if (questionIndex >= questions.length) {
    completeLesson();
  } else {
    renderQuestion();
  }
}

function shakeCard(): void {
  const card = document.querySelector<HTMLElement>(".question-card");
  if (!card) return;
  card.classList.remove("shake");
  void card.offsetWidth;
  card.classList.add("shake");
}

// ---------- 反馈与浮层 ----------
function hideFeedback(): void {
  if (feedbackTimer) {
    window.clearTimeout(feedbackTimer);
    feedbackTimer = undefined;
  }
  const feedback = $("#feedback");
  feedback.classList.remove("show");
  feedback.innerHTML = "";
  feedback.hidden = true;
}

function setLocked(value: boolean): void {
  locked = value;
  $<HTMLButtonElement>("#submitBtn").disabled = value;
}

function showOverlay(card: HTMLElement): void {
  const overlay = $("#overlay");
  overlay.innerHTML = "";
  overlay.append(card);
  overlay.hidden = false;
  setLocked(true);
}

function hideOverlay(): void {
  const overlay = $("#overlay");
  overlay.innerHTML = "";
  overlay.hidden = true;
}

// ---------- 课程完成 / 失败 ----------
function completeLesson(): void {
  const levelBefore = levelFromXp(progress.xp).level;
  progress = recordCompletion(lessonId, XP_LESSON_BONUS, GEMS_PER_LESSON);
  earnedXp += XP_LESSON_BONUS;
  const levelAfter = levelFromXp(progress.xp).level;
  renderHud();

  const card = el("div", "overlay-card");
  card.append(el("div", "overlay-emoji", "⭐"));
  card.append(el("h2", "overlay-title", "关卡完成！"));
  card.append(
    el("p", "overlay-text", `本次获得 ${earnedXp} 分、${GEMS_PER_LESSON} 枚金币`),
  );
  if (levelAfter > levelBefore) {
    card.append(el("p", "overlay-streak", `🎖️ 升级到 Lv.${levelAfter}`));
  }
  card.append(el("p", "overlay-streak", `🔥 连续打卡 ${progress.streak} 天`));

  const again = el("button", "btn-primary", "再来一次");
  again.type = "button";
  again.addEventListener("click", () => {
    hideOverlay();
    resetLesson();
  });
  const back = el("a", "btn-ghost", "返回学习大厅");
  back.href = "../";
  card.append(again, back);

  showOverlay(card);
}

function failLesson(): void {
  const card = el("div", "overlay-card");
  card.append(el("div", "overlay-emoji", "💔"));
  card.append(el("h2", "overlay-title", "生命用完了"));
  card.append(el("p", "overlay-text", "休息一下，明天再来保持你的连续打卡。"));

  const retry = el("button", "btn-primary", "重新开始");
  retry.type = "button";
  retry.addEventListener("click", () => {
    hideOverlay();
    resetLesson();
  });
  const back = el("a", "btn-ghost", "返回学习大厅");
  back.href = "../";
  card.append(retry, back);

  showOverlay(card);
}

function resetLesson(): void {
  hearts = MAX_HEARTS;
  combo = 0;
  earnedXp = 0;
  questionIndex = 0;
  renderHud();
  renderQuestion();
}

// ---------- 启动 ----------
function resolveLesson(): void {
  const params = new URLSearchParams(window.location.search);
  lessonId = params.get("lesson") ?? "number-negative";
  questions = LESSONS[lessonId] ?? [];

  const ref = findLessonById(lessonId);
  if (ref) {
    setText("#lessonTitle", `第 ${ref.index + 1} 课 · ${ref.lesson.title}`);
  }
}

function init(): void {
  setupPageTransitions();

  resolveLesson();
  $("#submitBtn").addEventListener("click", submit);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
  renderHud();

  if (questions.length === 0) {
    const lesson = $("#lesson");
    lesson.innerHTML = "";
    const card = el("div", "question-card");
    card.append(el("h2", "question-prompt", "这个关卡即将开放 🚧"));
    card.append(el("p", "feedback-hint", "完成前面的关卡，就能解锁这里。"));
    lesson.append(card);
    setLocked(true);
    return;
  }

  renderQuestion();
}

// ---------- 健康游戏 / 防沉迷 ----------
// 休息提醒出现时先把答题按钮锁住，休息结束后再恢复原状态
wellbeing = setupWellbeing({
  page: "game",
  gameName: "数字大陆",
  onRestStart: () => {
    if (lockedBeforeRest === null) lockedBeforeRest = locked;
    setLocked(true);
  },
  onRestEnd: () => {
    if (lockedBeforeRest === null) return;
    const restore = lockedBeforeRest;
    lockedBeforeRest = null;
    setLocked(restore);
  },
});

init();
