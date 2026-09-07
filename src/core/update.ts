import { readStorage, writeStorage } from "./storage";

export interface AppUpdateOptions {
  /** auto：发现新版后自动刷新；prompt：提示玩家手动更新（适合游戏中） */
  mode?: "auto" | "prompt";
}

const VERSION_KEY = "ryan-games:version";
const RELOAD_FLAG = "rg-update-refreshed";
const TOAST_ID = "rg-update-toast";

let notifiedWorker: ServiceWorker | null = null;

export function setupAppUpdate(options: AppUpdateOptions = {}): void {
  const mode = options.mode ?? "auto";

  if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
    void checkVersion(mode === "auto");
    return;
  }

  const base = import.meta.env.BASE_URL;

  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base, updateViaCache: "none" })
    .then((registration) => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          refreshAfterUpdate,
        );
      }

      if (registration.waiting && navigator.serviceWorker.controller) {
        notifyUpdate(registration.waiting, mode);
      }

      registration.addEventListener("updatefound", () => {
        const next = registration.installing;
        if (!next) return;

        next.addEventListener("statechange", () => {
          if (
            next.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            notifyUpdate(next, mode);
          }
        });
      });

      void registration.update().catch(() => undefined);
    })
    .catch(() => undefined);

  void checkVersion(mode === "auto");
}

function refreshAfterUpdate(): void {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, "1");
  window.location.reload();
}

window.addEventListener("pageshow", () => {
  sessionStorage.removeItem(RELOAD_FLAG);
});

function notifyUpdate(worker: ServiceWorker, mode: "auto" | "prompt"): void {
  if (notifiedWorker === worker) return;
  notifiedWorker = worker;

  if (mode === "auto") {
    showToast("发现新版本，正在更新…");
    window.setTimeout(() => {
      worker.postMessage({ type: "SKIP_WAITING" });
    }, 600);
    return;
  }

  showToast("发现新版本，立即更新", "立即更新", () => {
    worker.postMessage({ type: "SKIP_WAITING" });
  });
}

function ensureToast(): HTMLDivElement {
  let toast = document.getElementById(TOAST_ID) as HTMLDivElement | null;
  if (toast) return toast;

  toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:20px",
    "transform:translateX(-50%)",
    "z-index:9999",
    "display:none",
    "align-items:center",
    "gap:12px",
    "max-width:min(92vw,420px)",
    "background:#101c2c",
    "color:#eaf2fb",
    "border:1px solid rgba(255,255,255,0.16)",
    "border-radius:12px",
    "padding:11px 16px",
    "font:14px/1.5 system-ui,'PingFang SC','Microsoft YaHei',sans-serif",
    "box-shadow:0 10px 28px rgba(0,0,0,0.45)",
  ].join(";");
  document.body.append(toast);
  return toast;
}

function showToast(
  message: string,
  actionLabel?: string,
  onAction?: () => void,
): void {
  const toast = ensureToast();
  toast.replaceChildren();

  const text = document.createElement("span");
  text.textContent = message;
  toast.append(text);

  if (actionLabel && onAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = actionLabel;
    button.style.cssText = [
      "border:0",
      "border-radius:8px",
      "padding:7px 13px",
      "background:#ffcf00",
      "color:#1a1400",
      "font-weight:700",
      "cursor:pointer",
      "white-space:nowrap",
    ].join(";");
    button.addEventListener("click", () => {
      toast.style.display = "none";
      onAction();
    });
    toast.append(button);
  }

  toast.style.display = "flex";
}

async function checkVersion(autoReload: boolean): Promise<void> {
  const base = import.meta.env.BASE_URL;
  try {
    const response = await fetch(`${base}version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { version?: unknown };
    if (typeof payload.version !== "string" || !payload.version) return;

    const version = payload.version;
    const previous = readStorage(VERSION_KEY);
    writeStorage(VERSION_KEY, version);

    if (
      previous &&
      previous !== version &&
      !sessionStorage.getItem(`rg-version-refresh:${version}`)
    ) {
      sessionStorage.setItem(`rg-version-refresh:${version}`, "1");
      if (autoReload) {
        window.setTimeout(() => window.location.reload(), 900);
      } else {
        showToast("发现新版本，请刷新后体验", "刷新", () => {
          window.location.reload();
        });
      }
    }
  } catch {
    // 离线时跳过版本检查
  }
}
