import "./wellbeing.css";
import { readStorage, writeStorage } from "./storage";

/**
 * 健康游戏 / 防沉迷共享模块
 *
 * 所有页面（大厅、贪吃蛇、数字大陆）共用同一套逻辑：
 *  1. 每累计 20 分钟屏幕时间，提醒远眺 / 眨眼 / 站起来活动；
 *  2. 记录当天累计屏幕时间，达到家长设定的上限后提示"今天先玩到这里"；
 *  3. 护眼模式（暖色滤镜，默认开启）；
 *  4. 轮流展示户外活动小贴士，鼓励孩子多去户外运动。
 */

export type WellbeingPage = "game" | "hall";

export interface WellbeingOptions {
  /** game：休息时弹出全屏提醒并暂停游戏；hall：大厅只弹轻提示条 */
  page?: WellbeingPage;
  /** 游戏名，用于文案 */
  gameName?: string;
  /** 连续游戏多久提醒休息（分钟），默认 20 */
  restEveryMinutes?: number;
  /** 一次休息的最短秒数，默认 20 */
  restSeconds?: number;
  /** 每日屏幕时间上限（分钟），家长可在面板里修改，默认 60 */
  limitMinutes?: number;
  /** 在大厅页把健康卡片插入到哪个容器（CSS 选择器） */
  cardSlot?: string;
  /** 开始休息（游戏应暂停） */
  onRestStart?: () => void;
  /** 休息结束（游戏可以继续） */
  onRestEnd?: () => void;
}

export interface WellbeingController {
  /** 是否正在休息 / 被时长上限拦住 */
  isResting(): boolean;
  /** 今日已累计的屏幕时间（分钟） */
  todayMinutes(): number;
  /** 打开健康面板 */
  openPanel(): void;
}

interface Settings {
  eyeCare: boolean;
  limitMinutes: number;
}

interface DayState {
  date: string;
  minutes: number;
  rests: number;
  extensions: number;
  snoozeUntil: number;
}

const SETTINGS_KEY = "ryan-games:wellbeing:settings";
const DAY_KEY = "ryan-games:wellbeing:day";
const SESSION_KEY = "ryan-games:wellbeing:session";
const EYE_HINT_KEY = "ryan-games:wellbeing:eye-hint";

const TICK_MS = 5_000;
/** 连续 2 分钟没有任何操作，视为已经在休息 */
const IDLE_RESET_MS = 2 * 60_000;
/** 页面被切走超过 1 分钟，视为休息 */
const HIDDEN_RESET_MS = 60_000;
/** 点"再玩 10 分钟"后安静的时间 */
const SNOOZE_MS = 10 * 60_000;
/** 每天最多延长 2 次 */
const MAX_EXTENSIONS = 2;

const DEFAULT_LIMIT_MINUTES = 60;
const DEFAULT_REST_EVERY_MINUTES = 20;
const DEFAULT_REST_SECONDS = 20;
const LIMIT_CHOICES = [30, 45, 60, 90];

const EYE_TIPS = [
  "👀 抬头看看窗外或者 6 米外的东西，数满 20 秒。",
  "🙈 轻轻闭上眼 20 秒，让眼睛彻底歇一会儿。",
  "💧 去喝口水，顺便眨眨眼，眼睛会舒服很多。",
  "🪟 走到窗边，看看远处的树和天空。",
  "🤲 搓热双手轻轻捂住眼睛 10 秒，再望望远处。",
];

const MOVE_TIPS = [
  "🙆 站起来伸个懒腰，转转脖子、扭扭腰。",
  "🦵 原地跳 20 下，或者做 10 个深蹲。",
  "🚶 去阳台或走廊走两圈，再回来继续。",
  "🤸 手臂画几个大圈圈，肩膀会轻松很多。",
];

const OUTDOOR_TIPS = [
  "☀️ 每天户外 2 小时，可以大大降低近视的风险。",
  "⚽ 去楼下踢球、跳绳、骑车，比再过一关更酷。",
  "🌳 阳光下的户外活动，能让眼睛真正放松下来。",
  "🏃 叫上小伙伴去操场跑两圈，回来学习更专心。",
  "🚲 户外活动时眼睛看远看近，眼睛的肌肉更健康。",
];

let instance: WellbeingController | null = null;

export function setupWellbeing(
  options: WellbeingOptions = {},
): WellbeingController {
  if (instance) return instance;
  instance = create(options);
  return instance;
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
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

function dateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadSettings(fallbackLimit: number): Settings {
  const raw = readStorage(SETTINGS_KEY);
  const base: Settings = {
    eyeCare: true,
    limitMinutes: fallbackLimit,
  };
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      eyeCare: typeof parsed.eyeCare === "boolean" ? parsed.eyeCare : true,
      limitMinutes:
        typeof parsed.limitMinutes === "number" && parsed.limitMinutes > 0
          ? parsed.limitMinutes
          : fallbackLimit,
    };
  } catch {
    return base;
  }
}

function saveSettings(settings: Settings): void {
  writeStorage(SETTINGS_KEY, JSON.stringify(settings));
}

function loadDay(): DayState {
  const today = dateKey();
  const raw = readStorage(DAY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DayState>;
      if (parsed.date === today) {
        return {
          date: today,
          minutes: typeof parsed.minutes === "number" ? parsed.minutes : 0,
          rests: typeof parsed.rests === "number" ? parsed.rests : 0,
          extensions:
            typeof parsed.extensions === "number" ? parsed.extensions : 0,
          snoozeUntil:
            typeof parsed.snoozeUntil === "number" ? parsed.snoozeUntil : 0,
        };
      }
    } catch {
      // 数据损坏时重新开始统计
    }
  }
  return {
    date: today,
    minutes: 0,
    rests: 0,
    extensions: 0,
    snoozeUntil: 0,
  };
}

function loadContinuousMs(): number {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { continuousMs?: unknown };
    return typeof parsed.continuousMs === "number" ? parsed.continuousMs : 0;
  } catch {
    return 0;
  }
}

function create(options: WellbeingOptions): WellbeingController {
  const page: WellbeingPage = options.page ?? "game";
  const restEveryMs =
    (options.restEveryMinutes ?? DEFAULT_REST_EVERY_MINUTES) * 60_000;
  const restSeconds = options.restSeconds ?? DEFAULT_REST_SECONDS;

  const settings = loadSettings(options.limitMinutes ?? DEFAULT_LIMIT_MINUTES);
  const day = loadDay();

  let continuousMs = loadContinuousMs();
  let lastTick = Date.now();
  let lastActive = Date.now();
  let hiddenSince: number | null = document.hidden ? Date.now() : null;
  let resting = false;
  let restTimer: number | null = null;
  let toastTimer: number | null = null;

  // ---------- DOM ----------
  const root = el("div");
  root.id = "rgw-root";

  const eyeLayer = el("div", "rgw-eye-layer");
  eyeLayer.setAttribute("aria-hidden", "true");

  const fab = el("button", "rgw-fab");
  fab.type = "button";
  fab.title = "健康游戏 · 护眼设置";

  const panel = el("div", "rgw-panel");
  panel.hidden = true;

  const modal = el("div", "rgw-modal");
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const toast = el("div", "rgw-toast");
  toast.hidden = true;

  root.append(eyeLayer, fab, panel, modal, toast);
  document.body.append(root);

  // ---------- 面板 ----------
  const panelHead = el("div", "rgw-panel-head");
  panelHead.append(el("div", "rgw-panel-title", "🌿 健康游戏"));
  const closeBtn = el("button", "rgw-close", "✕");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "关闭");
  closeBtn.addEventListener("click", closePanel);
  panelHead.append(closeBtn);

  const meter = el("div", "rgw-meter");
  const meterTop = el("div", "rgw-meter-top");
  const meterNum = el("span", "rgw-meter-num", "0 分钟");
  const meterLabel = el("span", "", "今日屏幕时间");
  meterTop.append(meterLabel, meterNum);
  const meterBar = el("div", "rgw-bar");
  const meterFill = el("div", "rgw-bar-fill");
  meterBar.append(meterFill);
  meter.append(meterTop, meterBar);

  const restRow = el("div", "rgw-row");
  const restLabel = el("span", "rgw-row-label", "今天完成休息");
  const restValue = el("span", "", "0 次");
  restRow.append(restLabel, restValue);

  const eyeRow = el("div", "rgw-row");
  const eyeLabel = el("div", "rgw-row-label");
  eyeLabel.append(el("span", "", "护眼模式"));
  eyeLabel.append(el("span", "rgw-row-hint", "暖色画面，眼睛更舒服"));
  const eyeBtn = el("button", "rgw-switch");
  eyeBtn.type = "button";
  eyeBtn.addEventListener("click", () => {
    settings.eyeCare = !settings.eyeCare;
    saveSettings(settings);
    applyEyeCare();
    renderPanel();
    showToast(
      settings.eyeCare
        ? "🌿 护眼模式已开启，画面更柔和"
        : "护眼模式已关闭，建议还是开着哦",
    );
  });
  eyeRow.append(eyeLabel, eyeBtn);

  const limitRow = el("div", "rgw-row");
  const limitLabel = el("div", "rgw-row-label");
  limitLabel.append(el("span", "", "每天的时间约定"));
  limitLabel.append(el("span", "rgw-row-hint", "就是每天最多玩多久"));
  const limitChips = el("div", "rgw-limit-row");
  limitRow.append(limitLabel, limitChips);

  const tipList = el("ul", "rgw-tips");
  tipList.append(el("li", "", "🕐 每玩 20 分钟，就远眺 20 秒。"));
  tipList.append(el("li", "", "🌳 玩 20 分钟 + 户外活动，是最好的搭配。"));
  tipList.append(el("li", "", pick(OUTDOOR_TIPS)));

  panel.append(panelHead, meter, restRow, eyeRow, limitRow, tipList);

  LIMIT_CHOICES.forEach((minutes) => {
    const chip = el("button", "rgw-chip", `${minutes} 分钟`);
    chip.type = "button";
    chip.addEventListener("click", () => {
      settings.limitMinutes = minutes;
      saveSettings(settings);
      day.snoozeUntil = 0;
      saveDay();
      renderPanel();
      renderCard();
      renderFab();
      showToast(`好的，每天最多玩 ${minutes} 分钟`);
    });
    limitChips.append(chip);
  });

  // ---------- 大厅健康卡片 ----------
  const card = el("section", "rgw-card");
  const cardTitle = el("div", "rgw-card-title", "🌿 健康游戏小卫士");
  const cardSub = el("div", "rgw-card-sub");
  const cardMeter = el("div", "rgw-meter");
  const cardMeterTop = el("div", "rgw-meter-top");
  const cardMeterNum = el("span", "rgw-meter-num", "0 分钟");
  const cardMeterLabel = el("span", "", "今日屏幕时间");
  cardMeterTop.append(cardMeterLabel, cardMeterNum);
  const cardBar = el("div", "rgw-bar");
  const cardFill = el("div", "rgw-bar-fill");
  cardBar.append(cardFill);
  cardMeter.append(cardMeterTop, cardBar);
  const cardRest = el("div", "rgw-row");
  cardRest.append(el("span", "rgw-row-label", "今天完成休息"), el("span"));
  const cardEye = el("div", "rgw-row");
  const cardEyeLabel = el("div", "rgw-row-label");
  cardEyeLabel.append(el("span", "", "护眼模式"));
  const cardEyeBtn = el("button", "rgw-switch");
  cardEyeBtn.type = "button";
  cardEyeBtn.addEventListener("click", () => {
    settings.eyeCare = !settings.eyeCare;
    saveSettings(settings);
    applyEyeCare();
    renderPanel();
    renderCard();
  });
  cardEye.append(cardEyeLabel, cardEyeBtn);
  const cardPlan = el("div", "rgw-card-plan");
  card.append(cardTitle, cardSub, cardMeter, cardRest, cardEye, cardPlan);

  const cardSlot = options.cardSlot
    ? document.querySelector<HTMLElement>(options.cardSlot)
    : null;
  if (cardSlot) {
    cardSlot.append(card);
  } else {
    card.hidden = true;
  }

  // ---------- 事件 ----------
  fab.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderPanel();
  });

  document.addEventListener(
    "pointerdown",
    () => {
      lastActive = Date.now();
    },
    { passive: true },
  );
  document.addEventListener(
    "keydown",
    () => {
      lastActive = Date.now();
    },
    { passive: true },
  );
  document.addEventListener(
    "wheel",
    () => {
      lastActive = Date.now();
    },
    { passive: true },
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenSince = Date.now();
    } else {
      lastActive = Date.now();
    }
  });
  window.addEventListener("pagehide", () => {
    saveContinuous();
    saveDay();
  });

  // ---------- 逻辑 ----------
  function saveContinuous(): void {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ continuousMs: Math.round(continuousMs) }),
      );
    } catch {
      // 无痕模式下忽略
    }
  }

  function saveDay(): void {
    writeStorage(DAY_KEY, JSON.stringify(day));
  }

  function applyEyeCare(): void {
    document.documentElement.classList.toggle("rgw-eyecare", settings.eyeCare);
  }

  function limitRatio(): number {
    return settings.limitMinutes <= 0
      ? 0
      : day.minutes / settings.limitMinutes;
  }

  function fillClass(ratio: number): string {
    if (ratio >= 1) return "rgw-full";
    if (ratio >= 0.8) return "rgw-warn";
    return "";
  }

  function renderFab(): void {
    const minutes = Math.floor(day.minutes);
    fab.textContent = `🌿 ${minutes}分`;
    const ratio = limitRatio();
    fab.classList.toggle("rgw-warn", ratio >= 0.8 && ratio < 1);
    fab.classList.toggle("rgw-full", ratio >= 1);
    fab.title = `今日屏幕时间 ${minutes} / ${settings.limitMinutes} 分钟 · 点击查看护眼设置`;
  }

  function renderMeter(
    num: HTMLElement,
    fill: HTMLElement,
    label: HTMLElement | null,
  ): void {
    const minutes = Math.floor(day.minutes);
    const ratio = limitRatio();
    num.textContent = `${minutes} / ${settings.limitMinutes} 分钟`;
    num.classList.toggle("rgw-warn", ratio >= 0.8 && ratio < 1);
    num.classList.toggle("rgw-full", ratio >= 1);
    fill.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
    fill.className = `rgw-bar-fill ${fillClass(ratio)}`;
    if (label) label.textContent = "今日屏幕时间";
  }

  function renderPanel(): void {
    renderMeter(meterNum, meterFill, meterLabel);
    restValue.textContent = `${day.rests} 次`;
    eyeBtn.textContent = settings.eyeCare ? "已开启" : "已关闭";
    eyeBtn.classList.toggle("rgw-off", !settings.eyeCare);
    limitChips
      .querySelectorAll<HTMLButtonElement>(".rgw-chip")
      .forEach((chip) => {
        chip.classList.toggle(
          "rgw-active",
          chip.textContent === `${settings.limitMinutes} 分钟`,
        );
      });
  }

  function renderCard(): void {
    if (card.hidden) return;
    const every = Math.round(restEveryMs / 60_000);
    cardSub.textContent = options.gameName
      ? `在${options.gameName}里，每玩 ${every} 分钟都会提醒你远眺、站起来活动。`
      : `每玩 ${every} 分钟，都会提醒你远眺、站起来活动。`;
    renderMeter(cardMeterNum, cardFill, cardMeterLabel);
    (cardRest.lastElementChild as HTMLElement).textContent = `${day.rests} 次`;
    cardEyeBtn.textContent = settings.eyeCare ? "已开启" : "已关闭";
    cardEyeBtn.classList.toggle("rgw-off", !settings.eyeCare);
    cardPlan.textContent = `今天的约定：玩 ${every} 分钟 → 远眺 ${restSeconds} 秒 → 去户外跑一跑 → 再回来玩一轮。`;
  }

  function showToast(
    message: string,
    actionLabel?: string,
    onAction?: () => void,
  ): void {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
    toast.replaceChildren();
    toast.append(el("span", "rgw-toast-text", message));
    if (actionLabel && onAction) {
      const button = el("button", "rgw-toast-btn", actionLabel);
      button.type = "button";
      button.addEventListener("click", () => {
        hideToast();
        onAction();
      });
      toast.append(button);
    }
    toast.hidden = false;
    toastTimer = window.setTimeout(hideToast, actionLabel ? 12000 : 4200);
  }

  function hideToast(): void {
    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
    toast.hidden = true;
  }

  function closePanel(): void {
    panel.hidden = true;
  }

  function openModal(content: HTMLElement): void {
    modal.replaceChildren(content);
    modal.hidden = false;
    document.documentElement.classList.add("rgw-lock");
    root.classList.add("rgw-busy");
  }

  function closeModal(): void {
    modal.hidden = true;
    modal.replaceChildren();
    document.documentElement.classList.remove("rgw-lock");
    root.classList.remove("rgw-busy");
    if (restTimer !== null) {
      window.clearInterval(restTimer);
      restTimer = null;
    }
  }

  function buildModalCard(
    emoji: string,
    title: string,
    text: string,
    alert: boolean,
  ): HTMLElement {
    const box = el("div", "rgw-modal-card");
    box.append(el("div", "rgw-modal-emoji", emoji));
    box.append(
      el("h2", `rgw-modal-title${alert ? " rgw-alert" : ""}`, title),
    );
    box.append(el("p", "rgw-modal-text", text));
    return box;
  }

  function startRest(): void {
    if (resting) return;
    resting = true;
    closePanel();
    options.onRestStart?.();
    saveContinuous();

    const reason =
      page === "game"
        ? `已经连续玩了 ${Math.round(restEveryMs / 60_000)} 分钟，眼睛和脖子都要歇一歇。`
        : `已经连续看了 ${Math.round(restEveryMs / 60_000)} 分钟屏幕，让眼睛歇一歇吧。`;

    const box = buildModalCard("🌳", "休息时间到！", reason, false);

    const tips = el("ul", "rgw-tips");
    tips.append(el("li", "", pick(EYE_TIPS)));
    tips.append(el("li", "", pick(MOVE_TIPS)));
    tips.append(el("li", "", pick(OUTDOOR_TIPS)));
    box.append(tips);

    const count = el("div", "rgw-count");
    const countNum = el("span", "rgw-count-num", String(restSeconds));
    count.append(countNum, el("span", "rgw-count-unit", "秒"));
    const bar = el("div", "rgw-rest-bar");
    const fill = el("div", "rgw-rest-fill");
    bar.append(fill);
    box.append(count, bar);
    box.append(
      el("p", "rgw-note", "先看着远处，慢慢数 20 秒，眼睛会轻松很多。"),
    );

    const done = el("button", "rgw-btn rgw-btn-primary", "先休息一下…");
    done.type = "button";
    done.disabled = true;
    done.addEventListener("click", () => finishRest());
    const quit = el("button", "rgw-btn rgw-btn-ghost", "今天先玩到这里");
    quit.type = "button";
    quit.addEventListener("click", () => leaveForToday());
    box.append(done, quit);

    openModal(box);

    // 进度条用 CSS 过渡走完，数字每秒更新
    window.setTimeout(() => {
      fill.style.transition = `width ${restSeconds}s linear`;
      fill.style.width = "100%";
    }, 40);

    let remain = restSeconds;
    if (restTimer !== null) window.clearInterval(restTimer);
    restTimer = window.setInterval(() => {
      remain -= 1;
      if (remain > 0) {
        countNum.textContent = String(remain);
        return;
      }
      countNum.textContent = "0";
      if (restTimer !== null) {
        window.clearInterval(restTimer);
        restTimer = null;
      }
      done.disabled = false;
      done.textContent = "我休息好了，继续 ▶";
    }, 1000);
  }

  function finishRest(): void {
    closeModal();
    resting = false;
    continuousMs = 0;
    day.rests += 1;
    saveContinuous();
    saveDay();
    options.onRestEnd?.();
    renderAll();
    showToast("🌿 休息完成，护眼 +1，继续加油！");
  }

  function leaveForToday(): void {
    closeModal();
    resting = false;
    continuousMs = 0;
    saveContinuous();
    saveDay();
    showToast("🌳 今天先到这里，去户外活动一下吧！");
    const target = new URL("../", window.location.href).href;
    window.setTimeout(() => {
      window.location.href = target;
    }, 700);
  }

  function startLimit(): void {
    if (resting) return;
    resting = true;
    closePanel();
    options.onRestStart?.();

    const minutes = Math.floor(day.minutes);
    const box = buildModalCard(
      "⏰",
      "今天的游戏时间到啦",
      `今天已经玩了 ${minutes} 分钟，超过了约定的 ${settings.limitMinutes} 分钟。`,
      true,
    );

    const tips = el("ul", "rgw-tips");
    tips.append(el("li", "", pick(OUTDOOR_TIPS)));
    tips.append(el("li", "", pick(EYE_TIPS)));
    box.append(tips);

    const left = MAX_EXTENSIONS - day.extensions;
    if (left > 0) {
      const extend = el(
        "button",
        "rgw-btn rgw-btn-ghost",
        `再玩 10 分钟（今天还剩 ${left} 次）`,
      );
      extend.type = "button";
      extend.addEventListener("click", () => {
        day.extensions += 1;
        day.snoozeUntil = Date.now() + SNOOZE_MS;
        saveDay();
        closeModal();
        resting = false;
        options.onRestEnd?.();
        renderAll();
        showToast("⏳ 已延长 10 分钟，记得起来动一动眼睛");
      });
      box.append(extend);
    }

    const quit = el("button", "rgw-btn rgw-btn-alert", "好，今天收工！去户外活动");
    quit.type = "button";
    quit.addEventListener("click", () => leaveForToday());
    box.append(quit);
    box.append(
      el(
        "p",
        "rgw-note",
        left > 0
          ? "把剩下的时间留给户外活动，明天再来更厉害。"
          : "今天已经延长过两次啦，说话要算数哦。",
      ),
    );

    openModal(box);
  }

  function hallNotice(kind: "rest" | "limit"): void {
    if (kind === "limit") {
      const minutes = Math.floor(day.minutes);
      showToast(
        `⏰ 今天已经玩了 ${minutes} 分钟，去户外活动一下吧`,
        "去户外",
        () => {
          day.snoozeUntil = Date.now() + SNOOZE_MS * 3;
          saveDay();
          hideToast();
        },
      );
      return;
    }
    showToast(
      `🌳 连续看了 ${Math.round(restEveryMs / 60_000)} 分钟，抬头远眺 20 秒吧`,
      "休息好了",
      () => {
        continuousMs = 0;
        day.rests += 1;
        saveContinuous();
        saveDay();
        renderAll();
        hideToast();
      },
    );
  }

  function checkReminders(): void {
    if (resting) return;

    if (day.minutes >= settings.limitMinutes) {
      if (Date.now() < day.snoozeUntil) return;
      if (page === "game") startLimit();
      else hallNotice("limit");
      day.snoozeUntil = Date.now() + SNOOZE_MS;
      saveDay();
      return;
    }

    if (continuousMs >= restEveryMs) {
      continuousMs = 0;
      saveContinuous();
      if (page === "game") startRest();
      else hallNotice("rest");
    }
  }

  function tick(): void {
    const now = Date.now();
    const delta = Math.min(now - lastTick, TICK_MS * 3);
    lastTick = now;

    // 跨过零点就重新计时
    const today = dateKey();
    if (day.date !== today) {
      day.date = today;
      day.minutes = 0;
      day.rests = 0;
      day.extensions = 0;
      day.snoozeUntil = 0;
      saveDay();
    }

    if (resting) {
      continuousMs = 0;
      saveContinuous();
      return;
    }

    if (document.hidden) {
      if (hiddenSince === null) hiddenSince = now;
      saveContinuous();
      return;
    }

    if (hiddenSince !== null) {
      if (now - hiddenSince >= HIDDEN_RESET_MS) continuousMs = 0;
      hiddenSince = null;
      lastActive = now;
      saveContinuous();
      return;
    }

    if (now - lastActive > IDLE_RESET_MS) {
      continuousMs = 0;
      saveContinuous();
      return;
    }

    continuousMs += delta;
    day.minutes += delta / 60_000;
    saveContinuous();
    saveDay();
    renderFab();
    if (!panel.hidden) renderPanel();
    renderCard();
    checkReminders();
  }

  function renderAll(): void {
    renderFab();
    renderPanel();
    renderCard();
  }

  // ---------- 启动 ----------
  applyEyeCare();
  renderAll();

  if (!readStorage(EYE_HINT_KEY)) {
    writeStorage(EYE_HINT_KEY, "1");
    window.setTimeout(() => {
      showToast("🌿 已开启护眼模式，点右下角可以调整", "知道啦", hideToast);
    }, 1200);
  }

  window.setInterval(tick, TICK_MS);

  return {
    isResting: () => resting,
    todayMinutes: () => day.minutes,
    openPanel: () => {
      panel.hidden = false;
      renderPanel();
    },
  };
}
