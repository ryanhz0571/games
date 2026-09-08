import { COURSE, type LessonMeta } from "./course";
import { dailyCheckIn, levelFromXp, loadProgress, type Progress } from "./progress";

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

function setText(id: string, value: string | number): void {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = String(value);
  }
}

type LessonState = "completed" | "unlocked" | "locked";

function lessonState(
  unitIndex: number,
  lessonIndex: number,
  lesson: LessonMeta,
  progress: Progress,
): LessonState {
  if (unitIndex > 0) return "locked";
  if (!lesson.available) return "locked";
  if (progress.completed.includes(lesson.id)) return "completed";
  if (lessonIndex === 0) return "unlocked";
  const previous = COURSE[unitIndex].lessons[lessonIndex - 1];
  return progress.completed.includes(previous.id) ? "unlocked" : "locked";
}

function nextLessonId(progress: Progress): string | null {
  for (const unit of COURSE) {
    for (const lesson of unit.lessons) {
      if (lesson.available && !progress.completed.includes(lesson.id)) {
        return lesson.id;
      }
    }
  }
  return null;
}

function renderPath(progress: Progress): void {
  const container = $("#units");
  container.innerHTML = "";

  COURSE.forEach((unit, unitIndex) => {
    const card = el("div", `unit-card unit-${unit.color}`);
    if (unitIndex > 0) card.classList.add("locked");

    const header = el("div", "unit-header");
    header.append(el("span", "unit-emoji", unit.emoji));

    const heading = el("div", "unit-heading");
    heading.append(el("div", "unit-name", unit.name));
    heading.append(el("div", "unit-sub", unit.description));
    header.append(heading);

    const badge = el(
      "span",
      "unit-badge" + (unitIndex > 0 ? " locked" : ""),
      unitIndex > 0 ? "即将开放" : "进行中",
    );
    header.append(badge);
    card.append(header);

    const lessons = el("div", "unit-lessons");
    unit.lessons.forEach((lesson, lessonIndex) => {
      const state = lessonState(unitIndex, lessonIndex, lesson, progress);
      lessons.append(buildLessonNode(lesson, state));
    });
    card.append(lessons);

    container.append(card);
  });
}

function buildLessonNode(lesson: LessonMeta, state: LessonState): HTMLElement {
  const node =
    state === "locked"
      ? el("div", `lesson-node ${state}`)
      : el("a", `lesson-node ${state}`);

  if (node instanceof HTMLAnchorElement) {
    node.href = `./play/?lesson=${encodeURIComponent(lesson.id)}`;
  }

  const statusIcon =
    state === "completed" ? "✓" : state === "unlocked" ? "▶" : "🔒";
  node.append(el("span", "lesson-status", statusIcon));

  const text = el("div", "lesson-text");
  text.append(el("span", "lesson-title", lesson.title));
  if (lesson.subtitle) {
    text.append(el("span", "lesson-sub", lesson.subtitle));
  }
  node.append(text);

  node.append(
    el(
      "span",
      "lesson-arrow",
      state === "completed" ? "重玩" : state === "unlocked" ? "→" : "",
    ),
  );
  return node;
}

function setCta(progress: Progress): void {
  const link = $<HTMLAnchorElement>("#ctaLink");
  const nextId = nextLessonId(progress);
  if (nextId) {
    link.href = `./play/?lesson=${encodeURIComponent(nextId)}`;
    const ref = COURSE.flatMap((u) => u.lessons).find((l) => l.id === nextId);
    link.textContent = ref ? `继续学习 · ${ref.title}` : "继续学习";
  } else {
    link.href = "./play/";
    link.textContent = "全部完成 · 再练一次";
  }
}

function showDailyReward(checkIn: {
  streak: number;
  reward: number;
}): void {
  const card = el("div", "overlay-card");
  card.append(el("div", "overlay-emoji", "🎁"));
  card.append(el("h2", "overlay-title", `连续打卡第 ${checkIn.streak} 天`));
  card.append(el("p", "overlay-text", `每日奖励：+${checkIn.reward} 金币`));

  const button = el("button", "btn-primary", "收下奖励");
  button.type = "button";
  button.addEventListener("click", hideOverlay);
  card.append(button);

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

function init(): void {
  const checkIn = dailyCheckIn();
  const progress = loadProgress();
  const level = levelFromXp(progress.xp);

  setText("landingLevel", `Lv.${level.level}`);
  setText("landingLevelText", `Lv.${level.level}`);
  setText("landingXpText", `${level.current} / ${level.needed}`);
  setText("landingScore", progress.xp);
  setText("landingCoins", progress.gems);
  setText("landingStreak", `🔥 连续打卡 ${progress.streak} 天`);
  $("#landingXpBar").style.width = `${Math.round(level.progress * 100)}%`;

  renderPath(progress);
  setCta(progress);

  if (checkIn.isNewDay) {
    showDailyReward(checkIn);
  }
}

init();
