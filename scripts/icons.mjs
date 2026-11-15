// Generates the marketplace icon and the activity bar icon as pixel art with dfh.
// Run with `npm run icons`.
//
// Motif: a Japanese landscape (red sun, Mt. Fuji, waves) seen through a translucent editor
// window, i.e. a picture behind the code, which is what "Ushiro-e" means.
import { Canvas } from "dfh";

const SIZE = 32;

const COLORS = {
  washi: [239, 228, 204],
  sun: [212, 58, 47],
  fuji: [38, 53, 94],
  fujiLight: [62, 82, 135],
  snow: [250, 248, 242],
  sea: [31, 43, 77],
  wave: [120, 150, 205],
  foam: [235, 240, 250],
  window: [24, 26, 38],
  titleBar: [16, 17, 26],
  codeA: [244, 160, 176],
  codeB: [250, 214, 120],
  codeC: [150, 205, 255],
};

function hex([r, g, b]) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

/** Draws on a plain RGB grid first, so the translucent window can blend with the scene. */
function createGrid(size, color) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => [...color]));
}

function paintScene(grid) {
  // Sun
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if ((x - 23.5) ** 2 + (y - 8.5) ** 2 <= 5.5 ** 2) {
        grid[y][x] = [...COLORS.sun];
      }
    }
  }
  // Mt. Fuji: a flat top that widens by one pixel per row on each side, with a lighter right flank.
  const top = 11;
  const base = 25;
  for (let y = top; y < base; y++) {
    const half = 2 + (y - top) * 1.05;
    for (let x = Math.ceil(16 - half); x <= Math.floor(15 + half); x++) {
      if (x < 0 || x >= SIZE) {
        continue;
      }
      grid[y][x] = [...(x > 16 ? COLORS.fujiLight : COLORS.fuji)];
    }
  }
  // Snow cap with a jagged edge
  const snowLine = [15, 14, 16, 14, 15, 13, 15, 14, 16, 14, 15];
  for (let y = top; y < 17; y++) {
    const half = 2 + (y - top) * 1.05;
    for (let x = Math.ceil(16 - half); x <= Math.floor(15 + half); x++) {
      const limit = snowLine[(x + 20) % snowLine.length];
      if (y <= limit) {
        grid[y][x] = [...COLORS.snow];
      }
    }
  }
  // Sea with stylised waves
  for (let y = base; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      grid[y][x] = [...COLORS.sea];
    }
  }
  for (let x = 0; x < SIZE; x++) {
    const phase = x % 6;
    const crest = [0, 1, 1, 0, 0, 0][phase];
    grid[base + 1 - crest][x] = [...COLORS.wave];
    if (phase === 1) {
      grid[base - crest][x] = [...COLORS.foam];
    }
    const phase2 = (x + 3) % 6;
    grid[base + 4 - [0, 1, 1, 0, 0, 0][phase2]][x] = [...COLORS.wave];
  }
}

function blend(under, over, alpha) {
  return under.map((value, index) => value * (1 - alpha) + over[index] * alpha);
}

/** A translucent editor window over the lower left, with a title bar and a few code lines. */
function paintWindow(grid) {
  const left = 2;
  const right = 21;
  const top = 16;
  const bottom = 29;
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      grid[y][x] = y <= top + 1 ? [...COLORS.titleBar] : blend(grid[y][x], COLORS.window, 0.6);
    }
  }
  const lines = [
    [4, 9, COLORS.codeA, 11, 15, COLORS.codeC],
    [6, 12, COLORS.codeB],
    [6, 9, COLORS.codeC, 11, 17, COLORS.codeA],
    [4, 7, COLORS.codeA],
    [6, 14, COLORS.codeB],
    [4, 6, COLORS.codeC],
  ];
  lines.forEach((segments, row) => {
    const y = top + 3 + row * 2;
    if (y >= bottom) {
      return;
    }
    for (let i = 0; i < segments.length; i += 3) {
      const [from, to, color] = segments.slice(i, i + 3);
      for (let x = from; x <= to; x++) {
        grid[y][x] = [...color];
      }
    }
  });
}

function toCanvas(grid) {
  const canvas = new Canvas(grid.length, grid.length);
  grid.forEach((row, y) => row.forEach((color, x) => color && canvas.dot(x, y, hex(color))));
  return canvas;
}

/** Rounds the corners so the marketplace icon is not a hard square. */
function roundCorners(canvas, size) {
  [3, 2, 1].forEach((width, y) => {
    for (let x = 0; x < width; x++) {
      for (const [px, py] of [
        [x, y],
        [size - 1 - x, y],
        [x, size - 1 - y],
        [size - 1 - x, size - 1 - y],
      ]) {
        canvas.erase(px, py);
      }
    }
  });
}

const grid = createGrid(SIZE, COLORS.washi);
paintScene(grid);
paintWindow(grid);
const icon = toCanvas(grid);
roundCorners(icon, SIZE);
await icon.toPNG("resources/icon.png", { scale: 4 });

/**
 * Activity bar icon: VS Code only uses its shape, so it is a single colour.
 * A window frame with a sun and a mountain inside.
 */
const ACTIVITY_BAR = [
  "........................",
  "........................",
  "..XXXXXXXXXXXXXXXXXXXX..",
  "..XXXXXXXXXXXXXXXXXXXX..",
  "..XX................XX..",
  "..XX............XX..XX..",
  "..XX...........XXXX.XX..",
  "..XX...........XXXX.XX..",
  "..XX............XX..XX..",
  "..XX................XX..",
  "..XX.......XX.......XX..",
  "..XX......XXXX......XX..",
  "..XX.....XX..XX.....XX..",
  "..XX....XXXXXXXX....XX..",
  "..XX...XXXXXXXXXX...XX..",
  "..XX..XXXXXXXXXXXX..XX..",
  "..XX.XXXXXXXXXXXXXX.XX..",
  "..XXXXXXXXXXXXXXXXXXXX..",
  "..XX................XX..",
  "..XX.XX.XX..XX.XX...XX..",
  "..XX................XX..",
  "..XXXXXXXXXXXXXXXXXXXX..",
  "..XXXXXXXXXXXXXXXXXXXX..",
  "........................",
];

const bar = new Canvas(24, 24);
ACTIVITY_BAR.forEach((row, y) => {
  if (row.length !== 24) {
    throw new Error(`Activity bar row ${y} has ${row.length} pixels`);
  }
  [...row].forEach((key, x) => key === "X" && bar.dot(x, y, "#c5c5c5"));
});
bar.toSVG("resources/activitybar.svg", { title: "UshiroE" });

console.log(icon.toASCII());
