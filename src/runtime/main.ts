import { LIVE_CONFIG_VERSION, type LiveArea, type LiveConfig } from "../core/live";
import type { AreaId } from "../core/model";
import { createBackground } from "./background";
import { LAYOUT_READY_ATTRIBUTE, TITLEBAR_HEIGHT_VARIABLE, buildCss } from "./css";

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
  background: ReturnType<typeof createBackground>;
}

const STARTED_FLAG = "__ushiroeStarted";
const INDEX_STORAGE_PREFIX = "ushiroe.index.";
const PART_IDS: Record<Exclude<AreaId, "fullscreen">, string> = {
  editor: "workbench.parts.editor",
  sidebar: "workbench.parts.sidebar",
  auxiliaryBar: "workbench.parts.auxiliarybar",
  panel: "workbench.parts.panel",
};

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

/** Shows the fullscreen layer anyway if the workbench never reports a layout, so the background cannot stay hidden. */
const LAYOUT_READY_FALLBACK_MS = 5000;

/** The workbench gives its parts a size in the same task that sizes the title bar, so a sized editor part means the title bar can be measured. */
function isWorkbenchLaidOut(): boolean {
  const editor = document.getElementById(PART_IDS.editor);
  return editor !== null && editor.getBoundingClientRect().height > 0;
}

/**
 * Keeps {@link TITLEBAR_HEIGHT_VARIABLE} equal to the bottom edge of the custom title bar, or 0 when VS Code uses the native one, and sets {@link LAYOUT_READY_ATTRIBUTE} once that value is final. The title bar is created after this script runs, so it is looked up every frame until the workbench is laid out; it can also be rebuilt when the layout changes, so it is looked up again periodically after that.
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
  const markReady = () => {
    attach();
    root.setAttribute(LAYOUT_READY_ATTRIBUTE, "");
  };
  // requestAnimationFrame runs before the frame is painted, so the layer is revealed in the same frame the title bar gets its height.
  const waitForLayout = () => {
    if (root.hasAttribute(LAYOUT_READY_ATTRIBUTE)) {
      return;
    }
    if (isWorkbenchLaidOut()) {
      markReady();
      return;
    }
    attach();
    requestAnimationFrame(waitForLayout);
  };
  waitForLayout();
  setTimeout(markReady, LAYOUT_READY_FALLBACK_MS);
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
  const states = new Map<AreaId, AreaState>();
  let current: LiveConfig | undefined;
  let lastText = "";
  let polling = false;
  /** Playlists that already picked their first image in this window. */
  const startedPlaylists = new Set<string>();

  function showImage(state: AreaState, index: number, transition: number): void {
    state.index = index;
    storeIndex(state.area, index);
    void state.background.show(state.area.images[index], transition);
  }

  function advance(state: AreaState): void {
    const next = pickNextIndex(state);
    if (next === state.index) {
      return;
    }
    showImage(state, next, current?.transition ?? 0);
  }

  function startTimer(state: AreaState): void {
    if (state.timer !== undefined) {
      clearInterval(state.timer);
    }
    if (state.area.images.length > 1 && state.area.interval > 0) {
      state.timer = setInterval(() => advance(state), Math.max(1000, state.area.interval));
    }
  }

  /** The image each area should start with after a config change or at window start. */
  function firstIndex(area: LiveArea, previous: AreaState | undefined): number {
    const count = area.images.length;
    // Keep showing the same image when only other settings, such as the opacity, changed.
    if (previous && previous.area.images.join("\n") === area.images.join("\n")) {
      return previous.index;
    }
    const key = `${area.id}\n${area.images.join("\n")}`;
    const firstInThisWindow = !startedPlaylists.has(key);
    startedPlaylists.add(key);
    if (area.random && count > 1) {
      return Math.floor(Math.random() * count);
    }
    const stored = readStoredIndex(area);
    // "Change only at startup" moves on once each time a window starts.
    return area.changeOnStartupOnly && firstInThisWindow ? (stored + 1) % count : stored;
  }

  function mountBackgrounds(): void {
    for (const [id, { background }] of states) {
      if (!background.element.isConnected) {
        const parent = id === "fullscreen" ? document.body : document.getElementById(PART_IDS[id]);
        parent?.append(background.element);
      }
    }
  }

  function apply(config: LiveConfig): void {
    const areas = config.enabled ? config.areas.filter((area) => area.images.length > 0) : [];
    style.textContent = buildCss(config);
    if (!style.isConnected) {
      (document.head ?? root).appendChild(style);
    }
    const activeIds = new Set(areas.map((area) => area.id));
    for (const [id, state] of states) {
      if (!activeIds.has(id)) {
        clearInterval(state.timer);
        state.background.dispose();
        states.delete(id);
      }
    }
    for (const area of areas) {
      const previous = states.get(area.id);
      const index = firstIndex(area, previous);
      const state: AreaState = previous ?? {
        area,
        index,
        timer: undefined,
        background: createBackground(area.id),
      };
      state.area = area;
      states.set(area.id, state);
      showImage(state, index, config.transition);
      startTimer(state);
    }
    mountBackgrounds();
  }

  async function poll(): Promise<void> {
    // The workbench can create or replace a part without changing UshiroE's settings.
    mountBackgrounds();
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
        for (const state of states.values()) {
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
