import { LIVE_CONFIG_VERSION, type LiveArea, type LiveConfig } from "../core/live";
import { TITLEBAR_HEIGHT_VARIABLE, buildCss, cssUrl, cssVariable } from "./css";

export interface RuntimeBoot {
  /** `vscode-file:` URL of the live config JSON written by the extension. */
  configUrl: string;
  /** Milliseconds between checks of the live config while the window is visible. */
  pollInterval: number;
}

interface AreaState {
  area: LiveArea;
  index: number;
  timer: ReturnType<typeof setInterval> | undefined;
}

const STARTED_FLAG = "__ushiroeStarted";
const INDEX_STORAGE_PREFIX = "ushiroe.index.";

function sameExceptCycle(a: LiveConfig, b: LiveConfig): boolean {
  return JSON.stringify({ ...a, cycle: 0 }) === JSON.stringify({ ...b, cycle: 0 });
}

function readStoredIndex(area: LiveArea): number {
  try {
    const stored = Number(localStorage.getItem(INDEX_STORAGE_PREFIX + area.id));
    return Number.isInteger(stored) && stored >= 0 && stored < area.images.length ? stored : 0;
  } catch {
    return 0;
  }
}

function storeIndex(area: LiveArea, index: number): void {
  try {
    localStorage.setItem(INDEX_STORAGE_PREFIX + area.id, String(index));
  } catch {
    // Storage can be unavailable; rotation simply restarts from the first image.
  }
}

function pickNextIndex(state: AreaState): number {
  const count = state.area.images.length;
  if (count <= 1) {
    return 0;
  }
  if (!state.area.random) {
    return (state.index + 1) % count;
  }
  const offset = 1 + Math.floor(Math.random() * (count - 1));
  return (state.index + offset) % count;
}

/**
 * Keeps {@link TITLEBAR_HEIGHT_VARIABLE} equal to the bottom edge of the custom title bar, or 0
 * when VS Code uses the native one. The title bar is created after this script runs and can be
 * rebuilt when the layout changes, so it is looked up again periodically.
 */
function trackTitlebar(root: HTMLElement): void {
  let observed: Element | null = null;
  const update = () => {
    const bottom = observed?.isConnected ? observed.getBoundingClientRect().bottom : 0;
    root.style.setProperty(TITLEBAR_HEIGHT_VARIABLE, `${Math.max(0, Math.round(bottom))}px`);
  };
  const resize = new ResizeObserver(update);
  const attach = () => {
    const titlebar = document.getElementById("workbench.parts.titlebar");
    if (titlebar === observed) {
      return;
    }
    if (observed) {
      resize.unobserve(observed);
    }
    observed = titlebar;
    if (titlebar) {
      resize.observe(titlebar);
    }
    update();
  };
  attach();
  setInterval(attach, 2000);
}

export function start(boot: RuntimeBoot): void {
  const globalScope = window as unknown as Record<string, unknown>;
  if (globalScope[STARTED_FLAG]) {
    return;
  }
  globalScope[STARTED_FLAG] = true;

  const style = document.createElement("style");
  style.id = "ushiroe-style";
  const root = document.documentElement;
  trackTitlebar(root);
  let states: AreaState[] = [];
  let current: LiveConfig | undefined;
  let lastText = "";
  let polling = false;

  function showImage(state: AreaState, index: number): void {
    state.index = index;
    root.style.setProperty(cssVariable(state.area.id), cssUrl(state.area.images[index]));
    storeIndex(state.area, index);
  }

  function advance(state: AreaState): void {
    const next = pickNextIndex(state);
    if (next === state.index) {
      return;
    }
    // Switch only after the image is decoded so the cross-fade never shows an empty frame.
    const preload = new Image();
    preload.onload = preload.onerror = () => showImage(state, next);
    preload.src = state.area.images[next];
  }

  function startTimer(state: AreaState): void {
    if (state.timer !== undefined) {
      clearInterval(state.timer);
    }
    if (state.area.images.length > 1 && state.area.interval > 0) {
      state.timer = setInterval(() => advance(state), Math.max(1000, state.area.interval));
    }
  }

  function apply(config: LiveConfig): void {
    for (const state of states) {
      clearInterval(state.timer);
      root.style.removeProperty(cssVariable(state.area.id));
    }
    states = [];
    style.textContent = buildCss(config);
    if (!style.isConnected) {
      (document.head ?? root).appendChild(style);
    }
    if (!config.enabled) {
      return;
    }
    for (const area of config.areas) {
      if (area.images.length === 0) {
        continue;
      }
      const state: AreaState = { area, index: 0, timer: undefined };
      const first =
        area.random && area.images.length > 1
          ? Math.floor(Math.random() * area.images.length)
          : readStoredIndex(area);
      showImage(state, first);
      startTimer(state);
      states.push(state);
    }
  }

  async function poll(): Promise<void> {
    if (polling) {
      return;
    }
    polling = true;
    try {
      const response = await fetch(boot.configUrl, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const text = await response.text();
      if (text === lastText) {
        return;
      }
      lastText = text;
      const config = JSON.parse(text) as LiveConfig;
      if (config.v !== LIVE_CONFIG_VERSION) {
        return;
      }
      if (current && sameExceptCycle(current, config)) {
        for (const state of states) {
          advance(state);
          startTimer(state);
        }
      } else {
        apply(config);
      }
      current = config;
    } catch {
      // The file may be mid-write or missing; the next poll will pick it up.
    } finally {
      polling = false;
    }
  }

  void poll();
  setInterval(() => {
    if (document.visibilityState === "visible") {
      void poll();
    }
  }, boot.pollInterval);
  window.addEventListener("focus", () => void poll());
}
