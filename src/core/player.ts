import { readStorage, writeStorage } from "./storage";

const PLAYER_NAME_KEY = "ryan-games:profile:name";
const MAX_NAME_LENGTH = 12;

export function sanitizeName(name: string, maxLength = MAX_NAME_LENGTH): string {
  return name.trim().slice(0, maxLength);
}

export function normalizeName(name: string): string {
  return sanitizeName(name).toLocaleLowerCase();
}

export function loadPlayerName(): string {
  return readStorage(PLAYER_NAME_KEY) ?? "";
}

export function savePlayerName(name: string): void {
  const cleaned = sanitizeName(name);
  if (cleaned) {
    writeStorage(PLAYER_NAME_KEY, cleaned);
  }
}
