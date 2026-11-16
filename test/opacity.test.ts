import { describe, expect, it } from "vitest";

import { CONFIRM_OPACITY, MAX_OPACITY, defaultSettings } from "../src/core/model";
import { normalizeSettings } from "../src/core/normalize";
import { revertOpacity, riskyIncreases, visibleOpacities } from "../src/core/opacity";

function fullscreenAt(opacity: number, enabled = true) {
  const settings = defaultSettings();
  settings.enabled = enabled;
  settings.areas.fullscreen = { ...settings.areas.fullscreen, source: "*", opacity };
  return settings;
}

describe("opacity limits", () => {
  it("caps opacity read from settings.json at the maximum", () => {
    const settings = normalizeSettings({ fullscreen: { opacity: 0.95 }, editor: { opacity: 1 } });
    expect(settings.areas.fullscreen.opacity).toBe(MAX_OPACITY);
    expect(settings.areas.editor.opacity).toBe(MAX_OPACITY);
  });

  it("counts only areas that draw an image", () => {
    expect(visibleOpacities(fullscreenAt(0.7)).fullscreen).toBe(0.7);
    expect(visibleOpacities(fullscreenAt(0.7, false)).fullscreen).toBe(0);
    expect(visibleOpacities(fullscreenAt(0.7)).editor).toBe(0);
  });
});

describe("riskyIncreases", () => {
  const at = (opacity: number, enabled = true) => visibleOpacities(fullscreenAt(opacity, enabled));

  it("flags an area raised above the confirmation threshold", () => {
    expect(riskyIncreases(at(0.2), at(0.7))).toEqual(["fullscreen"]);
    expect(riskyIncreases(at(0.6), at(0.8))).toEqual(["fullscreen"]);
  });

  it("flags turning on a background that is already very opaque", () => {
    expect(riskyIncreases(at(0.7, false), at(0.7))).toEqual(["fullscreen"]);
  });

  it("ignores changes that stay at or below the threshold or lower the opacity", () => {
    expect(riskyIncreases(at(0.2), at(CONFIRM_OPACITY))).toEqual([]);
    expect(riskyIncreases(at(0.8), at(0.6))).toEqual([]);
    expect(riskyIncreases(at(0.7), at(0.7))).toEqual([]);
  });
});

describe("revertOpacity", () => {
  it("restores the previous value but never above the threshold", () => {
    expect(revertOpacity(0.2)).toBe(0.2);
    expect(revertOpacity(0.7)).toBe(CONFIRM_OPACITY);
  });
});
