import type { LiveArea, LiveConfig } from "../core/live";
import type { Size } from "../core/model";

const SIZE_RULES: Record<Size, string> = {
  cover: "background-size: cover; background-repeat: no-repeat;",
  contain: "background-size: contain; background-repeat: no-repeat;",
  auto: "background-size: auto; background-repeat: no-repeat;",
  stretch: "background-size: 100% 100%; background-repeat: no-repeat;",
  tile: "background-size: auto; background-repeat: repeat;",
};

export const BACKGROUND_ATTRIBUTE = "data-ushiroe-background";

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

/** Set on the root element once the workbench is laid out and {@link TITLEBAR_HEIGHT_VARIABLE} holds its final value. */
export const LAYOUT_READY_ATTRIBUTE = "data-ushiroe-layout-ready";

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

function areaRule(area: LiveArea): string {
  const isFullscreen = area.id === "fullscreen";
  const blur = area.blur > 0 ? `filter: blur(${area.blur}px);` : "";
  const selector = `[${BACKGROUND_ATTRIBUTE}="${area.id}"]`;
  // Until the title bar is measured, the fullscreen layer would start at the window top and visibly jump down.
  const hideUntilLaidOut = isFullscreen
    ? `\n:root:not([${LAYOUT_READY_ATTRIBUTE}]) ${selector} {\n  visibility: hidden;\n}`
    : "";
  return `${selector} {
  ${placement(area)}
  pointer-events: none;
  z-index: ${isFullscreen ? 2147483000 : 99};
  opacity: ${area.opacity};
  isolation: isolate;
  ${blur}
  transition: opacity 0.3s;
}
${selector} > div {
  position: absolute;
  inset: 0;
  mix-blend-mode: plus-lighter;
  background-position: ${sanitizePosition(area.position)};
  ${SIZE_RULES[area.size]}
}${hideUntilLaidOut}`;
}

export function buildCss(config: LiveConfig): string {
  if (!config.enabled) {
    return "";
  }
  return config.areas
    .filter((area) => area.images.length > 0)
    .map(areaRule)
    .join("\n");
}
