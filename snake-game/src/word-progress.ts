import { readStorage, writeStorage } from "../../src/core/storage";
import type { EnglishWord } from "./word-data";

interface WordCount {
  correct: number;
  wrong: number;
}

type WordProgressData = Record<string, WordCount>;

const MASTER_THRESHOLD = 2;

/** 记录每个单词的答对/答错次数，答对 2 次视为“已掌握”。 */
export class WordProgress {
  private data: WordProgressData = {};

  constructor(private readonly storageKey: string) {
    this.load();
  }

  record(word: string, correct: boolean): void {
    const key = word.toLocaleLowerCase();
    const entry = this.data[key] ?? { correct: 0, wrong: 0 };
    if (correct) {
      entry.correct += 1;
    } else {
      entry.wrong += 1;
    }
    this.data[key] = entry;
    this.save();
  }

  isMastered(word: string): boolean {
    const entry = this.data[word.toLocaleLowerCase()];
    return Boolean(entry && entry.correct >= MASTER_THRESHOLD);
  }

  masteredCount(words: readonly EnglishWord[]): number {
    return words.filter((item) => this.isMastered(item.word)).length;
  }

  private load(): void {
    const raw = readStorage(this.storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as WordProgressData;
      if (parsed && typeof parsed === "object") {
        this.data = parsed;
      }
    } catch {
      this.data = {};
    }
  }

  private save(): void {
    writeStorage(this.storageKey, JSON.stringify(this.data));
  }
}

export function progressKey(unitId: string): string {
  return `ryan-games:word-progress:snake:${unitId}`;
}
