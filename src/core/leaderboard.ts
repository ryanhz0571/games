import { readStorage, writeStorage } from "./storage";
import { normalizeName, sanitizeName } from "./player";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  updatedAt: number;
}

export interface SubmitResult {
  improved: boolean;
  isNew: boolean;
  rank: number | null;
}

interface PersistedBoard {
  version: number;
  entries: LeaderboardEntry[];
}

const STORAGE_VERSION = 1;
const MAX_STORED = 50;

function isEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LeaderboardEntry>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.score === "number" &&
    typeof item.updatedAt === "number"
  );
}

export class Leaderboard {
  private entries: LeaderboardEntry[] = [];
  private loaded = false;

  constructor(
    private readonly storageKey: string,
    private readonly maxShown = 10,
  ) {}

  list(): LeaderboardEntry[] {
    this.load();
    return [...this.entries];
  }

  shown(): LeaderboardEntry[] {
    return this.list().slice(0, this.maxShown);
  }

  best(name: string): number {
    this.load();
    const wanted = normalizeName(name);
    const entry = this.entries.find((item) => normalizeName(item.name) === wanted);
    return entry ? entry.score : 0;
  }

  submit(name: string, score: number): SubmitResult | null {
    const cleanName = sanitizeName(name);
    if (!cleanName || !Number.isFinite(score) || score <= 0) return null;

    this.load();
    const wanted = normalizeName(cleanName);
    const existingIndex = this.entries.findIndex(
      (item) => normalizeName(item.name) === wanted,
    );
    const isNew = existingIndex === -1;

    if (existingIndex !== -1) {
      const existing = this.entries[existingIndex];
      if (score <= existing.score) {
        const rank = this.rankOf(existing.id);
        return { improved: false, isNew: false, rank };
      }
      existing.name = cleanName;
      existing.score = score;
      existing.updatedAt = Date.now();
    } else {
      this.entries.push({
        id: crypto.randomUUID(),
        name: cleanName,
        score,
        updatedAt: Date.now(),
      });
    }

    this.sortAndPersist();
    const submitted = this.entries.find(
      (item) => normalizeName(item.name) === wanted,
    );
    const rank = submitted ? this.rankOf(submitted.id) : null;
    return { improved: true, isNew, rank };
  }

  private rankOf(id: string): number | null {
    const index = this.shown().findIndex((entry) => entry.id === id);
    return index === -1 ? null : index + 1;
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;

    const raw = readStorage(this.storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedBoard>;
      if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.entries)) {
        return;
      }
      this.entries = parsed.entries.filter(isEntry);
    } catch {
      this.entries = [];
    }

    this.sortAndPersist();
  }

  private sortAndPersist(): void {
    this.entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.updatedAt - b.updatedAt;
    });
    this.entries = this.entries.slice(0, MAX_STORED);

    const data: PersistedBoard = {
      version: STORAGE_VERSION,
      entries: this.entries,
    };
    writeStorage(this.storageKey, JSON.stringify(data));
  }
}
