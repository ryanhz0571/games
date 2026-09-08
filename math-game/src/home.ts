import { readStorage } from "../../src/core/storage";

function setText(id: string, value: string | number): void {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = String(value);
  }
}

function init(): void {
  setText(
    "landingStreak",
    `🔥 连续打卡 ${readStorage("ryan-games:math:streak") ?? "0"} 天`,
  );
  setText("landingScore", readStorage("ryan-games:math:xp") ?? "0");
  setText("landingCoins", readStorage("ryan-games:math:gems") ?? "0");
}

init();
