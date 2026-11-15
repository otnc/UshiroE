import { describe, expect, it } from "vitest";

import { defaultSettings } from "../src/core/model";
import { normalizeSettings } from "../src/core/normalize";
import { matchesPreset, pickRandomPreset, presetFromSettings } from "../src/core/presets";

describe("presets", () => {
  it("captures the layout and matches it until something changes", () => {
    const settings = defaultSettings();
    settings.mode = "parts";
    const preset = presetFromSettings("work", settings);
    expect(preset).toMatchObject({ name: "work", mode: "parts" });
    expect(matchesPreset(preset, settings)).toBe(true);
    settings.areas.editor.opacity = 0.5;
    expect(matchesPreset(preset, settings)).toBe(false);
  });

  it("picks a preset other than the one shown when there is a choice", () => {
    const settings = defaultSettings();
    const shown = presetFromSettings("shown", settings);
    const other = { ...presetFromSettings("other", settings), mode: "parts" as const };
    settings.presets = [shown, other];
    for (const value of [0, 0.5, 0.99]) {
      expect(pickRandomPreset(settings, () => value)?.name).toBe("other");
    }
    settings.presets = [shown];
    expect(pickRandomPreset(settings)?.name).toBe("shown");
    settings.presets = [];
    expect(pickRandomPreset(settings)).toBeNull();
  });

  it("normalizes presets and clears references to removed sources", () => {
    const settings = normalizeSettings({
      sources: [{ id: "a", type: "file", path: "/a.png" }],
      presets: [
        {
          id: "p",
          name: "night",
          mode: "parts",
          areas: { editor: { enabled: true, source: "gone" } },
        },
        { name: "  " },
        { id: "p", name: "duplicate" },
      ],
    });
    expect(settings.presets).toHaveLength(1);
    expect(settings.presets[0].areas.editor).toMatchObject({ enabled: true, source: null });
  });
});
