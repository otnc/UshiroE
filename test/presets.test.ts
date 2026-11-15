import { describe, expect, it } from "vitest";

import { normalizeSettings, parseImageRef } from "../src/core/normalize";
import { createPreset, imageRef, moveItem, withoutSources } from "../src/core/presets";

describe("presets", () => {
  it("start empty, from top to bottom, every 60 seconds", () => {
    expect(createPreset("Night")).toMatchObject({
      name: "Night",
      images: [],
      random: false,
      interval: 60,
      changeOnStartupOnly: false,
    });
  });

  it("reference images as <source id>/<file name>", () => {
    const ref = imageRef("src1", "0123abcd.png");
    expect(ref).toBe("src1/0123abcd.png");
    expect(parseImageRef(ref)).toEqual({ sourceId: "src1", file: "0123abcd.png" });
    expect(parseImageRef("no-slash")).toBeNull();
    expect(parseImageRef("trailing/")).toBeNull();
  });

  it("move items one place and stay inside the list", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], -1, 1)).toEqual(["a", "b", "c"]);
  });

  it("drop the images of a removed source", () => {
    const preset = { ...createPreset("Mix"), images: ["a/1.png", "b/2.png", "ab/3.png"] };
    expect(withoutSources(preset, "a").images).toEqual(["b/2.png", "ab/3.png"]);
  });

  it("are normalized from settings.json", () => {
    const settings = normalizeSettings({
      presets: [
        { id: "p", name: "Night", images: ["s/1.png", 3, "bad"], random: true },
        { name: "  " },
        { id: "p", name: "duplicate" },
      ],
    });
    expect(settings.presets).toEqual([
      {
        id: "p",
        name: "Night",
        images: ["s/1.png"],
        random: true,
        interval: 60,
        changeOnStartupOnly: false,
      },
    ]);
  });
});
