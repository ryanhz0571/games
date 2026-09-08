import { readStorage, writeStorage } from "../../src/core/storage";

const KEY = "ryan-games:math:progress";
const XP_PER_LEVEL = 100;

export interface Progress {
  streak: number;
  lastPlayed: string;
  xp: number;
  gems: number;
  completed: string[];
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function loadProgress(): Progress {
  const raw = readStorage(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Progress>;
      return {
        streak: typeof parsed.streak === "number" ? parsed.streak : 0,
        lastPlayed: typeof parsed.lastPlayed === "string" ? parsed.lastPlayed : "",
        xp: typeof parsed.xp === "number" ? parsed.xp : 0,
        gems: typeof parsed.gems === "number" ? parsed.gems : 0,
        completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      };
    } catch {
      // 解析失败则走下面的迁移逻辑
    }
  }

  // 兼容旧版分散存储
  return {
    streak: Number(readStorage("ryan-games:math:streak") ?? "0"),
    lastPlayed: readStorage("ryan-games:math:lastPlayed") ?? "",
    xp: Number(readStorage("ryan-games:math:xp") ?? "0"),
    gems: Number(readStorage("ryan-games:math:gems") ?? "0"),
    completed: [],
  };
}

export function saveProgress(progress: Progress): void {
  writeStorage(KEY, JSON.stringify(progress));
}

export function levelFromXp(xp: number): {
  level: number;
  current: number;
  needed: number;
  progress: number;
} {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const current = xp % XP_PER_LEVEL;
  return {
    level,
    current,
    needed: XP_PER_LEVEL,
    progress: current / XP_PER_LEVEL,
  };
}

export function recordCompletion(
  lessonId: string,
  xpGain: number,
  gemGain: number,
): Progress {
  const progress = loadProgress();
  progress.xp += xpGain;
  progress.gems += gemGain;
  if (!progress.completed.includes(lessonId)) {
    progress.completed.push(lessonId);
  }

  const today = dateKey(new Date());
  if (progress.lastPlayed !== today) {
    const yesterday = dateKey(new Date(Date.now() - 86_400_000));
    progress.streak = progress.lastPlayed === yesterday ? progress.streak + 1 : 1;
    progress.lastPlayed = today;
  }

  saveProgress(progress);
  return progress;
}

export function dailyCheckIn(): {
  isNewDay: boolean;
  streak: number;
  reward: number;
} {
  const progress = loadProgress();
  const today = dateKey(new Date());
  if (progress.lastPlayed === today) {
    return { isNewDay: false, streak: progress.streak, reward: 0 };
  }

  const yesterday = dateKey(new Date(Date.now() - 86_400_000));
  const newStreak = progress.lastPlayed === yesterday ? progress.streak + 1 : 1;
  const reward = Math.min(newStreak, 7) * 5;

  progress.streak = newStreak;
  progress.lastPlayed = today;
  progress.gems += reward;
  saveProgress(progress);

  return { isNewDay: true, streak: newStreak, reward };
}
