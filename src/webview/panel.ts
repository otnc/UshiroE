import {
  ALL_SOURCES,
  type AreaId,
  type AreaSettings,
  type ImageSource,
  type Mode,
  PRESET_PREFIX,
  type Preset,
  type Rotation,
  type UshiroeSettings,
} from "../core/model";
import type { Ownership } from "../core/ownership";
import type { Strings } from "../ui/strings";

interface SourceView extends ImageSource {
  count: number;
  thumbnail: string | null;
  images: { file: string; ref: string; thumbnail: string }[];
}

interface PresetView extends Preset {
  entries: { ref: string; thumbnail: string | null }[];
}

interface State {
  settings: UshiroeSettings;
  sources: SourceView[];
  presets: PresetView[];
  library: { root: string; isDefault: boolean };
  status: {
    patch: "applied" | "outdated" | "missing" | "unknown";
    hasBackImage: boolean;
    backImageInstalled: boolean;
    restartPending: boolean;
    waitingForRestart: boolean;
    ownership: Ownership;
    problem: "truncated" | "modified" | null;
  };
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): { open?: string[] } | undefined;
  setState(state: { open: string[] }): void;
}

declare function acquireVsCodeApi(): VsCodeApi;
declare global {
  interface Window {
    USHIROE_STRINGS: Strings;
  }
}

const vscode = acquireVsCodeApi();
const t = window.USHIROE_STRINGS;
const app = document.getElementById("app") as HTMLElement;
const openDetails = new Set<string>(vscode.getState()?.open ?? []);
let state: State | undefined;

const PART_ORDER: AreaId[] = ["editor", "sidebar", "auxiliaryBar", "panel"];
const FIT_OPTIONS: AreaSettings["size"][] = ["cover", "contain", "auto", "stretch", "tile"];
const POSITIONS: [string, keyof Strings][] = [
  ["center", "position_center"],
  ["top", "position_top"],
  ["bottom", "position_bottom"],
  ["left", "position_left"],
  ["right", "position_right"],
  ["top left", "position_topLeft"],
  ["top right", "position_topRight"],
  ["bottom left", "position_bottomLeft"],
  ["bottom right", "position_bottomRight"],
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function format(template: string, ...values: (string | number)[]): string {
  return template.replace(/\{(\d+)\}/g, (_match, index: string) =>
    String(values[Number(index)] ?? "")
  );
}

function icon(name: string): string {
  return `<i class="codicon codicon-${name}" aria-hidden="true"></i>`;
}

function button(
  label: string,
  action: string,
  options: { icon?: string; primary?: boolean; title?: string } = {}
): string {
  const classes = [
    "button",
    options.primary ? "primary" : "secondary",
    options.icon && !label ? "icon-only" : "",
  ].join(" ");
  const title = options.title ?? label;
  return `<button type="button" class="${classes}" data-action="${action}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${options.icon ? icon(options.icon) : ""}${label ? `<span>${escapeHtml(label)}</span>` : ""}</button>`;
}

function options(values: [string, string][], selected: string): string {
  return values
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function notice(kind: "info" | "warn" | "error", text: string, buttons: string[] = []): string {
  const iconName = kind === "info" ? "info" : kind === "warn" ? "warning" : "error";
  return `<div class="notice ${kind}">${icon(iconName)}<p>${escapeHtml(text)}</p>${buttons.length > 0 ? `<div class="button-row">${buttons.join("")}</div>` : ""}</div>`;
}

function ownershipNotices(status: State["status"]): string[] {
  const notices: string[] = [];
  if (status.problem) {
    notices.push(
      notice("error", status.problem === "truncated" ? t.problemTruncated : t.problemModified, [
        button(t.restoreWorkbench, "cmd:ushiroe.restoreWorkbench", { icon: "history" }),
      ])
    );
  }
  switch (status.ownership.kind) {
    case "conflict":
      notices.push(
        notice("warn", t.backImageConflict, [
          button(t.uninstallBackImage, "cmd:ushiroe.uninstallBackImage"),
          button(t.disableBackImage, "cmd:ushiroe.disableBackImage"),
          button(t.letBackImageTakeOver, "cmd:ushiroe.setBackImagePriority|backImage"),
        ])
      );
      break;
    case "backImage":
      notices.push(
        notice("info", t.backImageManaging, [
          button(t.letUshiroeManage, "cmd:ushiroe.setBackImagePriority|ushiroe"),
        ])
      );
      break;
    case "ushiroe":
      if (status.ownership.priorityIgnored) {
        notices.push(notice("info", t.priorityIgnored));
      }
      break;
  }
  if (status.waitingForRestart) {
    notices.push(
      notice("info", t.waitingForRestart, [button(t.quit, "cmd:workbench.action.quit")])
    );
  }
  return notices;
}

function renderStatus(current: State): string {
  const { settings, status } = current;
  const patchText = {
    applied: t.patchApplied,
    outdated: t.patchOutdated,
    missing: t.patchMissing,
    unknown: t.patchUnknown,
  }[status.patch];
  const patchIcon =
    status.patch === "applied" ? "pass" : status.patch === "unknown" ? "question" : "warning";
  const notices: string[] = [];
  if (status.restartPending) {
    notices.push(
      `<div class="notice info">${icon("info")}<p>${escapeHtml(t.restartPending)}</p>${button(t.quit, "cmd:workbench.action.quit", { primary: true })}</div>`
    );
  }
  notices.push(...ownershipNotices(status));
  return `<section class="status">
  <div class="status-main">
    <span class="dot ${settings.enabled ? "on" : "off"}"></span>
    <strong>${escapeHtml(settings.enabled ? t.enabled : t.disabled)}</strong>
    <span class="spacer"></span>
    ${button("", "cmd:ushiroe.nextImage", { icon: "arrow-right", title: t.nextImage })}
    ${button(settings.enabled ? t.turnOff : t.turnOn, "toggle", { primary: !settings.enabled })}
  </div>
  <div class="patch ${status.patch}">
    ${icon(patchIcon)}<span>${escapeHtml(patchText)}</span>
    <span class="spacer"></span>
    ${button("", "cmd:ushiroe.repairPatch", { icon: "tools", title: t.repair })}
    ${button("", "cmd:ushiroe.removePatch", { icon: "discard", title: t.removePatch })}
  </div>
  ${notices.join("")}
</section>`;
}

function renderMode(mode: Mode): string {
  const item = (value: Mode, label: string, iconName: string) =>
    `<button type="button" role="radio" aria-checked="${mode === value}" class="segment${mode === value ? " selected" : ""}" data-action="mode:${value}">${icon(iconName)}<span>${escapeHtml(label)}</span></button>`;
  return `<section>
  <h2>${escapeHtml(t.mode)}</h2>
  <div class="segmented" role="radiogroup" aria-label="${escapeHtml(t.mode)}">
    ${item("fullscreen", t.modeFullscreen, "screen-full")}
    ${item("parts", t.modeParts, "layout")}
  </div>
</section>`;
}

function renderArea(id: AreaId, area: AreaSettings, current: State): string {
  const isPart = id !== "fullscreen";
  const title = t[`area_${id}` as keyof Strings];
  const choice = (value: string, label: string) =>
    `<option value="${escapeHtml(value)}"${value === (area.source ?? "") ? " selected" : ""}>${escapeHtml(label)}</option>`;
  const presetOptions = current.presets
    .map((preset) => choice(PRESET_PREFIX + preset.id, preset.name))
    .join("");
  const sourceOptions = current.sources.map((source) => choice(source.id, source.name)).join("");
  const imageSelect = `${choice("", t.noImage)}${choice(ALL_SOURCES, t.allImages)}${
    presetOptions ? `<optgroup label="${escapeHtml(t.presets)}">${presetOptions}</optgroup>` : ""
  }${sourceOptions ? `<optgroup label="${escapeHtml(t.sources)}">${sourceOptions}</optgroup>` : ""}`;
  const positions: [string, string][] = POSITIONS.map(([value, key]) => [value, t[key]]);
  if (!POSITIONS.some(([value]) => value === area.position)) {
    positions.push([area.position, format(t.position_custom, area.position)]);
  }
  const header = isPart
    ? `<label class="area-toggle"><input type="checkbox" data-scope="area" data-id="${id}" data-field="enabled"${area.enabled ? " checked" : ""}><span>${escapeHtml(title)}</span></label>`
    : `<span class="area-title">${escapeHtml(title)}</span>`;
  const collapsed = isPart && !area.enabled;
  const attrs = `data-scope="area" data-id="${id}"`;
  return `<div class="card${collapsed ? " collapsed" : ""}">
  <div class="card-header">${header}</div>
  ${
    collapsed
      ? ""
      : `<div class="card-body">
    <label class="field"><span>${escapeHtml(t.image)}</span><select ${attrs} data-field="source">${imageSelect}</select></label>
    <label class="field"><span>${escapeHtml(t.opacity)} <output id="opacity-${id}">${Math.round(area.opacity * 100)}%</output></span>
      <input type="range" min="0" max="1" step="0.01" value="${area.opacity}" ${attrs} data-field="opacity" data-output="opacity-${id}"></label>
    <div class="row">
      <label class="field"><span>${escapeHtml(t.fit)}</span><select ${attrs} data-field="size">${options(
        FIT_OPTIONS.map((fit) => [fit, t[`fit_${fit}`]]),
        area.size
      )}</select></label>
      <label class="field"><span>${escapeHtml(t.position)}</span><select ${attrs} data-field="position">${options(positions, area.position)}</select></label>
    </div>
    <label class="field"><span>${escapeHtml(t.blur)}</span><input type="number" min="0" max="200" step="1" value="${area.blur}" ${attrs} data-field="blur"></label>
  </div>`
  }
</div>`;
}

function renderAreas(current: State): string {
  const ids: AreaId[] = current.settings.mode === "fullscreen" ? ["fullscreen"] : PART_ORDER;
  return `<section class="areas">${ids.map((id) => renderArea(id, current.settings.areas[id], current)).join("")}</section>`;
}

function messageButton(
  label: string,
  message: Record<string, unknown>,
  options: { icon?: string; title?: string; disabled?: boolean } = {}
): string {
  const title = options.title ?? label;
  return `<button type="button" class="button ${label ? "secondary" : "secondary icon-only"}" data-message="${escapeHtml(JSON.stringify(message))}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"${options.disabled ? " disabled" : ""}>${options.icon ? icon(options.icon) : ""}${label ? `<span>${escapeHtml(label)}</span>` : ""}</button>`;
}

/** Order, interval and "only at startup", shared by sources, presets and All images. */
function rotationFields(
  scope: "source" | "preset" | "all",
  id: string,
  rotation: Rotation
): string {
  const attrs = `data-scope="${scope}" data-id="${escapeHtml(id)}"`;
  const timed = !rotation.changeOnStartupOnly;
  return `<div class="rotation">
  <label class="field"><span>${escapeHtml(t.order)}</span><select ${attrs} data-field="random">${options(
    [
      ["false", t.order_sequential],
      ["true", t.order_random],
    ],
    String(rotation.random)
  )}</select></label>
  <label class="check"><input type="checkbox" ${attrs} data-field="changeOnStartupOnly"${rotation.changeOnStartupOnly ? " checked" : ""}><span>${escapeHtml(t.changeOnStartupOnly)}</span></label>
  ${
    timed
      ? `<label class="field"><span>${escapeHtml(t.interval)}</span><input type="number" min="0" step="1" value="${rotation.interval}" ${attrs} data-field="interval"></label>`
      : ""
  }
</div>`;
}

function imageRow(
  thumbnail: string | null,
  label: string,
  moves: {
    up: Record<string, unknown>;
    down: Record<string, unknown>;
    first: boolean;
    last: boolean;
  },
  remove: { message: Record<string, unknown>; title: string } | null
): string {
  return `<li class="image-row">
  <div class="thumb small">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy">` : icon("warning")}</div>
  <span class="image-label">${escapeHtml(label)}</span>
  <span class="spacer"></span>
  ${messageButton("", moves.up, { icon: "arrow-up", title: t.moveUp, disabled: moves.first })}
  ${messageButton("", moves.down, { icon: "arrow-down", title: t.moveDown, disabled: moves.last })}
  ${remove ? messageButton("", remove.message, { icon: "close", title: remove.title }) : ""}
</li>`;
}

function renderSource(source: SourceView, index: number, total: number): string {
  const id = escapeHtml(source.id);
  const detailsId = `source-${source.id}`;
  const isUrl = source.type === "url";
  const meta =
    source.count === 0
      ? `<span class="error">${icon("error")} ${escapeHtml(t.notFound)}</span>`
      : escapeHtml(format(t.imageCount, source.count));
  const thumbnail = source.thumbnail
    ? `<img src="${escapeHtml(source.thumbnail)}" alt="" loading="lazy">`
    : icon(source.type === "folder" ? "folder" : isUrl ? "globe" : "file-media");
  const origin = isUrl
    ? `<label class="field"><span>${escapeHtml(t.refresh)}</span><select data-scope="source" data-id="${id}" data-field="refresh">${options(
        [
          ["never", t.refresh_never],
          ["startup", t.refresh_startup],
        ],
        source.refresh
      )}</select></label>
      <div class="field"><span>${escapeHtml(t.url)}</span><div class="origin" title="${escapeHtml(source.path)}">${escapeHtml(source.path)}</div></div>`
    : `<div class="field"><span>${escapeHtml(t.importedFrom)}</span><div class="origin" title="${escapeHtml(source.path)}">${escapeHtml(source.path)}</div></div>`;
  const images =
    source.images.length > 1
      ? `<div class="field"><span>${escapeHtml(t.imageOrder)}</span><ol class="image-list">${source.images
          .map((image, position) =>
            imageRow(
              image.thumbnail,
              format(t.imageNumber, position + 1),
              {
                up: { type: "moveSourceImage", id: source.id, file: image.file, delta: -1 },
                down: { type: "moveSourceImage", id: source.id, file: image.file, delta: 1 },
                first: position === 0,
                last: position === source.images.length - 1,
              },
              isUrl
                ? null
                : {
                    message: { type: "removeSourceImage", id: source.id, file: image.file },
                    title: t.deleteImageFile,
                  }
            )
          )
          .join("")}</ol></div>`
      : "";
  const actions = [
    isUrl
      ? button(t.downloadAgain, `cmd:ushiroe.refreshSource|${source.id}`, { icon: "sync" })
      : button(t.addImagesToSource, `cmd:ushiroe.addImagesToSource|${source.id}`, { icon: "add" }),
    button(t.openSourceFolder, `cmd:ushiroe.openSourceFolder|${source.id}`, {
      icon: "folder-opened",
    }),
  ];
  return `<li class="source${source.count === 0 ? " missing" : ""}">
  <div class="source-main">
    <div class="reorder">
      ${messageButton("", { type: "moveSource", id: source.id, delta: -1 }, { icon: "chevron-up", title: t.moveUp, disabled: index === 0 })}
      ${messageButton("", { type: "moveSource", id: source.id, delta: 1 }, { icon: "chevron-down", title: t.moveDown, disabled: index === total - 1 })}
    </div>
    <div class="thumb">${thumbnail}</div>
    <div class="source-text">
      <div class="source-name">${escapeHtml(source.name)}</div>
      <div class="source-meta"><span class="badge">${escapeHtml(t[`type_${source.type}` as keyof Strings])}</span>${meta}</div>
    </div>
    ${button("", `remove:${source.id}`, { icon: "trash", title: t.removeSource })}
  </div>
  <details data-details="${escapeHtml(detailsId)}"${openDetails.has(detailsId) ? " open" : ""}>
    <summary>${escapeHtml(t.details)}</summary>
    <div class="details-body">
      <label class="field"><span>${escapeHtml(t.name)}</span><input type="text" value="${escapeHtml(source.name)}" data-scope="source" data-id="${id}" data-field="name"></label>
      ${source.count > 1 ? rotationFields("source", source.id, source) : ""}
      ${images}
      ${origin}
      <div class="button-row">${actions.join("")}</div>
    </div>
  </details>
</li>`;
}

function renderSources(current: State): string {
  const list =
    current.sources.length === 0
      ? `<p class="empty">${escapeHtml(t.noSources)}</p>`
      : `<ul class="sources">${current.sources.map((source, index) => renderSource(source, index, current.sources.length)).join("")}</ul>`;
  return `<section>
  <div class="section-header">
    <h2>${escapeHtml(t.sources)}</h2>
    <div class="add-buttons">
      ${button(t.addFile, "cmd:ushiroe.addImageFile", { icon: "file-media" })}
      ${button(t.addFolder, "cmd:ushiroe.addImageFolder", { icon: "folder" })}
      ${button(t.addUrl, "cmd:ushiroe.addImageUrl", { icon: "globe" })}
    </div>
  </div>
  ${list}
</section>`;
}

function renderPreset(preset: PresetView, current: State): string {
  const detailsId = `preset-${preset.id}`;
  const pickerId = `picker-${preset.id}`;
  const entries =
    preset.entries.length === 0
      ? `<p class="empty">${escapeHtml(t.noPresetImages)}</p>`
      : `<ol class="image-list">${preset.entries
          .map((entry, index) =>
            imageRow(
              entry.thumbnail,
              format(t.imageNumber, index + 1),
              {
                up: { type: "movePresetImage", id: preset.id, index, delta: -1 },
                down: { type: "movePresetImage", id: preset.id, index, delta: 1 },
                first: index === 0,
                last: index === preset.entries.length - 1,
              },
              {
                message: { type: "removePresetImage", id: preset.id, index },
                title: t.removeFromPreset,
              }
            )
          )
          .join("")}</ol>`;
  const picker = current.sources
    .filter((source) => source.images.length > 0)
    .map(
      (source) => `<div class="picker-group">
      <div class="picker-title">${escapeHtml(source.name)}</div>
      <div class="picker-grid">${source.images
        .map(
          (image, index) =>
            `<button type="button" class="picker-item" data-message="${escapeHtml(JSON.stringify({ type: "addPresetImage", id: preset.id, ref: image.ref }))}" title="${escapeHtml(format(t.addImageNumber, source.name, index + 1))}"><img src="${escapeHtml(image.thumbnail)}" alt="${escapeHtml(format(t.addImageNumber, source.name, index + 1))}" loading="lazy"></button>`
        )
        .join("")}</div>
    </div>`
    )
    .join("");
  const strip = preset.entries
    .slice(0, 6)
    .map((entry) =>
      entry.thumbnail ? `<img src="${escapeHtml(entry.thumbnail)}" alt="" loading="lazy">` : ""
    )
    .join("");
  return `<li class="preset">
  <details data-details="${escapeHtml(detailsId)}"${openDetails.has(detailsId) ? " open" : ""}>
    <summary>
      <span class="preset-name">${escapeHtml(preset.name)}</span>
      <span class="preset-meta">${escapeHtml(format(t.imageCount, preset.entries.length))}</span>
      <span class="preset-strip">${strip}</span>
    </summary>
    <div class="details-body">
      <label class="field"><span>${escapeHtml(t.name)}</span><input type="text" value="${escapeHtml(preset.name)}" data-scope="preset" data-id="${escapeHtml(preset.id)}" data-field="name"></label>
      ${rotationFields("preset", preset.id, preset)}
      <div class="field"><span>${escapeHtml(t.imageOrder)}</span>${entries}</div>
      <details class="picker" data-details="${escapeHtml(pickerId)}"${openDetails.has(pickerId) ? " open" : ""}>
        <summary>${icon("add")} ${escapeHtml(t.addToPreset)}</summary>
        <p class="hint">${escapeHtml(t.addToPresetHint)}</p>
        ${picker || `<p class="empty">${escapeHtml(t.noSources)}</p>`}
      </details>
      <div class="button-row">${button(t.deletePreset, `cmd:ushiroe.deletePreset|${preset.id}`, { icon: "trash" })}</div>
    </div>
  </details>
</li>`;
}

function renderPresets(current: State): string {
  const list =
    current.presets.length === 0
      ? `<p class="empty">${escapeHtml(t.noPresets)}</p>`
      : `<ul class="presets">${current.presets.map((preset) => renderPreset(preset, current)).join("")}</ul>`;
  return `<section>
  <div class="section-header">
    <h2>${escapeHtml(t.presets)}</h2>
    <div class="add-buttons">${button(t.newPreset, "cmd:ushiroe.newPreset", { icon: "add" })}</div>
  </div>
  <p class="hint">${escapeHtml(t.presetsHint)}</p>
  ${list}
</section>`;
}

function renderAllImages(current: State): string {
  return `<section>
  <h2>${escapeHtml(t.allImages)}</h2>
  <p class="hint">${escapeHtml(t.allImagesHint)}</p>
  ${rotationFields("all", "all", current.settings.allImages)}
</section>`;
}

function renderLibrary(current: State): string {
  return `<section>
  <h2>${escapeHtml(t.library)}</h2>
  <p class="hint">${escapeHtml(t.libraryHint)}</p>
  <div class="library-path" title="${escapeHtml(current.library.root)}">${icon("folder-library")}<span>${escapeHtml(current.library.root)}</span></div>
  <div class="button-row">
    ${button(t.openLibrary, "cmd:ushiroe.openLibrary", { icon: "folder-opened" })}
    ${button(t.chooseLibrary, "cmd:ushiroe.chooseLibraryFolder", { icon: "edit" })}
    ${current.library.isDefault ? "" : button(t.resetLibrary, "cmd:ushiroe.resetLibraryFolder", { icon: "discard" })}
    ${button(t.refreshImages, "cmd:ushiroe.refreshImages", { icon: "sync" })}
  </div>
</section>`;
}

function renderTransfer(): string {
  return `<section>
  <h2>${escapeHtml(t.transfer)}</h2>
  <div class="button-row">
    ${button(t.importBackImage, "cmd:ushiroe.importBackImage", { icon: "history" })}
    ${button(t.importSettings, "cmd:ushiroe.importSettings", { icon: "cloud-download" })}
    ${button(t.exportSettings, "cmd:ushiroe.exportSettings", { icon: "cloud-upload" })}
  </div>
</section>`;
}

/** Re-renders everything while keeping keyboard focus and scroll position. */
function render(): void {
  if (!state) {
    return;
  }
  const active = document.activeElement as HTMLElement | null;
  const focusSelector = active?.dataset.field
    ? `[data-scope="${CSS.escape(active.dataset.scope ?? "")}"][data-id="${CSS.escape(active.dataset.id ?? "")}"][data-field="${CSS.escape(active.dataset.field)}"]`
    : active?.dataset.action
      ? `[data-action="${CSS.escape(active.dataset.action)}"]`
      : active?.dataset.message
        ? `[data-message="${CSS.escape(active.dataset.message)}"]`
        : null;
  const scroll = window.scrollY;
  app.innerHTML = [
    renderStatus(state),
    renderMode(state.settings.mode),
    renderAreas(state),
    renderSources(state),
    renderPresets(state),
    renderAllImages(state),
    renderLibrary(state),
    renderTransfer(),
  ].join("");
  if (focusSelector) {
    (app.querySelector(focusSelector) as HTMLElement | null)?.focus();
  }
  window.scrollTo(0, scroll);
}

function fieldValue(input: HTMLInputElement | HTMLSelectElement): unknown {
  if (input instanceof HTMLInputElement) {
    if (input.type === "checkbox") {
      return input.checked;
    }
    if (input.type === "number" || input.type === "range") {
      const value = Number(input.value);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    }
  }
  const value = input.value;
  if (input.dataset.field === "random") {
    return value === "true";
  }
  return input.dataset.field === "source" && value === "" ? null : value;
}

app.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action], [data-message]"
  );
  if (!target || !state) {
    return;
  }
  if (target.dataset.message) {
    vscode.postMessage(JSON.parse(target.dataset.message));
    return;
  }
  const action = target.dataset.action ?? "";
  if (action === "toggle") {
    vscode.postMessage({ type: "setEnabled", value: !state.settings.enabled });
  } else if (action.startsWith("mode:")) {
    vscode.postMessage({ type: "setMode", value: action.slice(5) });
  } else if (action.startsWith("cmd:")) {
    const [command, arg] = action.slice(4).split("|");
    vscode.postMessage({ type: "command", command, arg });
  } else if (action.startsWith("remove:")) {
    vscode.postMessage({ type: "removeSource", id: action.slice(7) });
  }
});

app.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.type === "range" && input.dataset.output) {
    const output = document.getElementById(input.dataset.output);
    if (output) {
      output.textContent = `${Math.round(Number(input.value) * 100)}%`;
    }
  }
});

const UPDATE_MESSAGES: Record<string, string> = {
  area: "updateArea",
  source: "updateSource",
  preset: "updatePreset",
  all: "updateAllImages",
};

app.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  const { scope, id, field } = input.dataset;
  const type = scope ? UPDATE_MESSAGES[scope] : undefined;
  if (!type || !field) {
    return;
  }
  vscode.postMessage({ type, id, patch: { [field]: fieldValue(input) } });
});

app.addEventListener(
  "toggle",
  (event) => {
    const details = event.target as HTMLDetailsElement;
    const id = details.dataset.details;
    if (!id) {
      return;
    }
    if (details.open) {
      openDetails.add(id);
    } else {
      openDetails.delete(id);
    }
    vscode.setState({ open: [...openDetails] });
  },
  true
);

window.addEventListener("message", (event: MessageEvent<{ type: string } & State>) => {
  if (event.data.type === "state") {
    state = event.data;
    render();
  }
});

vscode.postMessage({ type: "ready" });
