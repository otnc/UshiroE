import { describe, expect, it } from "vitest";

import { convertBackImageState } from "../src/migration/backimage";

const LISTS = [
  { id: "1", type: "file", path: "C:\\Pictures\\a.png", name: "a", description: "" },
  {
    id: "2",
    type: "folder",
    path: "C:\\Pictures\\wallpapers",
    name: "walls",
    description: " desc ",
  },
];

describe("convertBackImageState", () => {
  it("returns null for anything that is not an object", () => {
    expect(convertBackImageState(null)).toBeNull();
    expect(convertBackImageState("text")).toBeNull();
  });

  it("converts a fullscreen setup and inverts the fullscreen opacity", () => {
    const settings = convertBackImageState({
      imageLists: LISTS,
      elementsRandom: { "2": true },
      elementsInterval: { "2": 30000 },
      elementsOpacity: { fullscreen: 0.8, editor: 0.3, panel: 0.25, sideBar: 0.4 },
      backgroundImg: { fullscreen: "2", panel: null, sideBar: null, editor: null },
      backgroundType: "fullscreen",
      enable: true,
    });
    expect(settings).not.toBeNull();
    expect(settings?.enabled).toBe(true);
    expect(settings?.mode).toBe("fullscreen");
    expect(settings?.sources).toEqual([
      {
        id: "1",
        name: "a",
        type: "file",
        path: "C:\\Pictures\\a.png",
        description: "",
        random: false,
        interval: 10,
        recursive: false,
        refresh: "never",
      },
      {
        id: "2",
        name: "walls",
        type: "folder",
        path: "C:\\Pictures\\wallpapers",
        description: " desc ",
        random: true,
        interval: 30,
        recursive: false,
        refresh: "never",
      },
    ]);
    expect(settings?.areas.fullscreen.source).toBe("2");
    expect(settings?.areas.fullscreen.opacity).toBeCloseTo(0.2);
    expect(settings?.areas.editor.opacity).toBe(0.3);
    expect(settings?.areas.sidebar.opacity).toBe(0.4);
  });

  it("maps part types, including BackImage's side-bar name", () => {
    const settings = convertBackImageState({
      imageLists: LISTS,
      backgroundImg: { fullscreen: null, panel: "1", sideBar: "2", editor: "1" },
      backgroundType: ["side-bar", "editor"],
      enable: true,
    });
    expect(settings?.mode).toBe("parts");
    expect(settings?.areas.sidebar).toMatchObject({ enabled: true, source: "2" });
    expect(settings?.areas.editor).toMatchObject({ enabled: true, source: "1" });
    expect(settings?.areas.panel).toMatchObject({ enabled: false, source: "1" });
    expect(settings?.areas.auxiliaryBar.enabled).toBe(false);
  });

  it("stays disabled when BackImage had no background type, like BackImage itself", () => {
    const settings = convertBackImageState({
      imageLists: LISTS,
      backgroundImg: { fullscreen: "1" },
      backgroundType: null,
      enable: true,
    });
    expect(settings?.enabled).toBe(false);
    expect(settings?.areas.fullscreen.source).toBe("1");
  });

  it("drops broken entries and references to unknown lists", () => {
    const settings = convertBackImageState({
      imageLists: [...LISTS, { id: "3" }, "junk", { ...LISTS[0] }],
      backgroundImg: { fullscreen: "missing" },
      backgroundType: "fullscreen",
      enable: false,
    });
    expect(settings?.sources.map((source) => source.id)).toEqual(["1", "2"]);
    expect(settings?.areas.fullscreen.source).toBeNull();
    expect(settings?.enabled).toBe(false);
  });
});
