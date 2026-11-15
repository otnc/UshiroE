import type { LiveArea, LiveConfig } from "../core/live";
import type { AreaId, Size } from "../core/model";

/**
 * Parts use `::before` because VS Code itself draws the editor shadow with `.part.editor::after`.
 * The parent `.split-view-view` is absolutely positioned and has the same box as the part, so `inset: 0` covers exactly the part.
 */
const AREA_SELECTORS: Record<AreaId, string> = {
  fullscreen: "body::after",
  editor: ".monaco-workbench [id='workbench.parts.editor']::before",
  sidebar: ".monaco-workbench [id='workbench.parts.sidebar']::before",
  auxiliaryBar: ".monaco-workbench [id='workbench.parts.auxiliarybar']::before",
  panel: ".monaco-workbench [id='workbench.parts.panel']::before",
};

const SIZE_RULES: Record<Size, string> = {
  cover: "background-size: cover; background-repeat: no-repeat;",
  contain: "background-size: contain; background-repeat: no-repeat;",
  auto: "background-size: auto; background-repeat: no-repeat;",
  stretch: "background-size: 100% 100%; background-repeat: no-repeat;",
  tile: "background-size: auto; background-repeat: repeat;",
};

export function cssVariable(id: AreaId): string {
  return `--ushiroe-${id}-image`;
}

/** Keeps a user-provided `background-position` from closing the declaration block. */
export function sanitizePosition(position: string): string {
  const cleaned = position.replace(/[;{}<>"'\\]/g, "").trim();
  return cleaned === "" ? "center" : cleaned;
}

export function cssUrl(url: string): string {
  return `url("${url.replace(/["\\\n\r]/g, (char) => encodeURIComponent(char))}")`;
}

/** Height of the custom title bar (File, Edit, ...), kept up to date by the runtime. */
export const TITLEBAR_HEIGHT_VARIABLE = "--ushiroe-titlebar-height";

/**
 * Where the layer sits. The fullscreen layer starts below the title bar, so the menu bar stays clear. Blur pulls transparent pixels in from outside the box: the fullscreen layer bleeds past the window edges to hide that soft edge and is clipped back at the title bar; a part layer cannot bleed, because it would cover its neighbours.
 */
function placement(area: LiveArea): string {
  if (area.id !== "fullscreen") {
    return "position: absolute; inset: 0;";
  }
  const top = `var(${TITLEBAR_HEIGHT_VARIABLE}, 0px)`;
  if (area.blur <= 0) {
    return `position: fixed; inset: 0; top: ${top};`;
  }
  const bleed = area.blur * 2;
  return `position: fixed; inset: -${bleed}px; top: calc(${top} - ${bleed}px); clip-path: inset(${bleed}px 0 0 0);`;
}

function areaRule(area: LiveArea, transition: number): string {
  const isFullscreen = area.id === "fullscreen";
  const blur = area.blur > 0 ? `filter: blur(${area.blur}px);` : "";
  return `${AREA_SELECTORS[area.id]} {
  content: "";
  ${placement(area)}
  pointer-events: none;
  z-index: ${isFullscreen ? 2147483000 : 99};
  opacity: ${area.opacity};
  background-image: var(${cssVariable(area.id)});
  background-position: ${sanitizePosition(area.position)};
  ${SIZE_RULES[area.size]}
  ${blur}
  transition: background-image ${transition}s ease-in-out, opacity 0.3s;
}`;
}

export function buildCss(config: LiveConfig): string {
  if (!config.enabled) {
    return "";
  }
  return config.areas
    .filter((area) => area.images.length > 0)
    .map((area) => areaRule(area, config.transition))
    .join("\n");
}
