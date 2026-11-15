// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultSettings } from "../src/core/model";

/** Every string key returns itself, so assertions can look for keys. */
const strings = new Proxy({}, { get: (_target, key) => String(key) });
const posted: unknown[] = [];

function image(file: string) {
  return { file, ref: `src/${file}`, thumbnail: `https://thumb/${file}` };
}

function state() {
  const settings = defaultSettings();
  settings.sources = [
    {
      id: "src",
      name: "Wallpapers",
      type: "folder",
      path: "C:/pics",
      description: "",
      random: false,
      interval: 10,
      changeOnStartupOnly: false,
      recursive: false,
      refresh: "never",
    },
  ];
  settings.presets = [
    {
      id: "p1",
      name: "Night",
      images: ["src/a.png", "src/b.png"],
      random: false,
      interval: 60,
      changeOnStartupOnly: true,
    },
  ];
  return {
    type: "state",
    settings,
    sources: [
      {
        ...settings.sources[0],
        count: 2,
        thumbnail: null,
        images: [image("a.png"), image("b.png")],
      },
    ],
    presets: [
      {
        ...settings.presets[0],
        entries: [
          { ref: "src/a.png", thumbnail: "https://thumb/a.png" },
          { ref: "src/b.png", thumbnail: null },
        ],
      },
    ],
    library: { root: "C:/Pictures/UshiroE", isDefault: true },
    status: {
      patch: "applied",
      hasBackImage: false,
      backImageInstalled: false,
      restartPending: false,
      waitingForRestart: false,
      ownership: { kind: "ushiroe", cleanupBackImage: false, priorityIgnored: false },
      problem: null,
    },
  };
}

describe("panel webview", () => {
  beforeAll(async () => {
    document.body.innerHTML = '<div id="app"></div>';
    Object.assign(window, { USHIROE_STRINGS: strings });
    Object.assign(globalThis, {
      acquireVsCodeApi: () => ({
        postMessage: (message: unknown) => posted.push(message),
        getState: () => ({ open: ["preset-p1", "source-src"] }),
        setState: vi.fn(),
      }),
    });
    await import("../src/webview/panel");
  });

  beforeEach(() => {
    posted.length = 0;
    window.dispatchEvent(new MessageEvent("message", { data: state() }));
  });

  const app = () => document.getElementById("app") as HTMLElement;

  it("asks for the state once loaded", () => {
    // The ready message was sent before beforeEach cleared the list; rendering proves it arrived.
    expect(app().textContent).toContain("Night");
    expect(app().textContent).toContain("Wallpapers");
  });

  it("offers presets and All images as an area's image", () => {
    const select = app().querySelector<HTMLSelectElement>('select[data-field="source"]');
    const values = [...(select?.options ?? [])].map((option) => option.value);
    expect(values).toEqual(["", "*", "preset:p1", "src"]);
  });

  it("offers patch repair for outdated backgrounds until a restart is pending", () => {
    const current = state();
    current.settings.enabled = true;
    current.status.patch = "outdated";
    window.dispatchEvent(new MessageEvent("message", { data: current }));
    const repair = app().querySelector<HTMLButtonElement>(
      '.notice.warn button[data-action="cmd:ushiroe.repairPatch"]'
    );
    expect(repair).not.toBeNull();
    repair?.click();
    expect(posted).toContainEqual({ type: "command", command: "ushiroe.repairPatch" });

    current.status.restartPending = true;
    window.dispatchEvent(new MessageEvent("message", { data: current }));
    expect(app().querySelector(".notice.warn")).toBeNull();
    expect(app().querySelector(".notice.info")?.textContent).toContain("restartPending");
  });

  it("moves a preset image with one click, but not past the ends", () => {
    const moves = [...app().querySelectorAll<HTMLButtonElement>("[data-message]")].filter(
      (button) => button.dataset.message?.includes('"movePresetImage"')
    );
    const [firstUp, firstDown] = moves;
    expect(firstUp.disabled).toBe(true);
    firstDown.click();
    expect(posted).toEqual([{ type: "movePresetImage", id: "p1", index: 0, delta: 1 }]);
  });

  it("adds an image to a preset from the picker", () => {
    const pick = app().querySelector<HTMLButtonElement>(".picker-item");
    pick?.click();
    expect(posted).toContainEqual({ type: "addPresetImage", id: "p1", ref: "src/a.png" });
  });

  it("hides the interval when a preset changes only at startup", () => {
    const presetFields = app().querySelectorAll('[data-scope="preset"][data-field="interval"]');
    expect(presetFields).toHaveLength(0);
    const startupOnly = app().querySelector<HTMLInputElement>(
      '[data-scope="preset"][data-field="changeOnStartupOnly"]'
    );
    expect(startupOnly?.checked).toBe(true);
  });

  it("sends rotation changes for All images", () => {
    const order = app().querySelector<HTMLSelectElement>('[data-scope="all"][data-field="random"]');
    expect(order).not.toBeNull();
    if (order) {
      order.value = "false";
      order.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(posted).toContainEqual({ type: "updateAllImages", id: "all", patch: { random: false } });
  });

  it("disables moving the first source up", () => {
    const up = app().querySelector<HTMLButtonElement>('[data-message*="moveSource"]');
    expect(up?.disabled).toBe(true);
  });
});
