import type { AreaId, AreaSettings, ImageSource, Mode, UshiroeSettings } from "../core/model";
import type { Strings } from "../ui/strings";

interface SourceView extends ImageSource {
    count: number;
    thumbnail: string | null;
}

interface State {
    settings: UshiroeSettings;
    sources: SourceView[];
    status: {
        patch: "applied" | "outdated" | "missing" | "unknown";
        hasBackImage: boolean;
        backImageInstalled: boolean;
        restartPending: boolean;
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
const SIZES: AreaSettings["size"][] = ["cover", "contain", "auto", "stretch", "tile"];
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
    return template.replace(/\{(\d+)\}/g, (_match, index: string) => String(values[Number(index)] ?? ""));
}

function icon(name: string): string {
    return `<i class="codicon codicon-${name}" aria-hidden="true"></i>`;
}

function button(label: string, action: string, options: { icon?: string; primary?: boolean; title?: string } = {}): string {
    const classes = ["button", options.primary ? "primary" : "secondary", options.icon && !label ? "icon-only" : ""].join(" ");
    const title = options.title ?? label;
    return `<button type="button" class="${classes}" data-action="${action}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${options.icon ? icon(options.icon) : ""}${label ? `<span>${escapeHtml(label)}</span>` : ""}</button>`;
}

function options(values: [string, string][], selected: string): string {
    return values
        .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
        .join("");
}

function renderStatus(current: State): string {
    const { settings, status } = current;
    const patchText = {
        applied: t.patchApplied,
        outdated: t.patchOutdated,
        missing: t.patchMissing,
        unknown: t.patchUnknown,
    }[status.patch];
    const patchIcon = status.patch === "applied" ? "pass" : status.patch === "unknown" ? "question" : "warning";
    const notices: string[] = [];
    if (status.restartPending) {
        notices.push(`<div class="notice info">${icon("info")}<p>${escapeHtml(t.restartPending)}</p>${button(t.quit, "cmd:workbench.action.quit", { primary: true })}</div>`);
    }
    if (status.hasBackImage || status.backImageInstalled) {
        notices.push(`<div class="notice warn">${icon("warning")}<p>${escapeHtml(t.backImageConflict)}</p>${button(t.importBackImage, "cmd:ushiroe.importBackImage")}</div>`);
    }
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

function renderArea(id: AreaId, area: AreaSettings, sources: SourceView[]): string {
    const isPart = id !== "fullscreen";
    const title = t[`area_${id}` as keyof Strings];
    const sourceOptions = options([["", t.noImage], ...sources.map((source): [string, string] => [source.id, source.name])], area.source ?? "");
    const positions: [string, string][] = POSITIONS.map(([value, key]) => [value, t[key]]);
    if (!POSITIONS.some(([value]) => value === area.position)) {
        positions.push([area.position, format(t.position_custom, area.position)]);
    }
    const header = isPart
        ? `<label class="area-toggle"><input type="checkbox" data-area="${id}" data-field="enabled"${area.enabled ? " checked" : ""}><span>${escapeHtml(title)}</span></label>`
        : `<span class="area-title">${escapeHtml(title)}</span>`;
    const collapsed = isPart && !area.enabled;
    return `<div class="card${collapsed ? " collapsed" : ""}">
  <div class="card-header">${header}</div>
  ${collapsed ? "" : `<div class="card-body">
    <label class="field"><span>${escapeHtml(t.image)}</span><select data-area="${id}" data-field="source">${sourceOptions}</select></label>
    <label class="field"><span>${escapeHtml(t.opacity)} <output id="opacity-${id}">${Math.round(area.opacity * 100)}%</output></span>
      <input type="range" min="0" max="1" step="0.01" value="${area.opacity}" data-area="${id}" data-field="opacity" data-output="opacity-${id}"></label>
    <div class="row">
      <label class="field"><span>${escapeHtml(t.size)}</span><select data-area="${id}" data-field="size">${options(SIZES.map((size) => [size, t[`size_${size}` as keyof Strings]]), area.size)}</select></label>
      <label class="field"><span>${escapeHtml(t.position)}</span><select data-area="${id}" data-field="position">${options(positions, area.position)}</select></label>
    </div>
    <label class="field"><span>${escapeHtml(t.blur)}</span><input type="number" min="0" max="200" step="1" value="${area.blur}" data-area="${id}" data-field="blur"></label>
  </div>`}
</div>`;
}

function renderAreas(current: State): string {
    const { settings, sources } = current;
    const ids: AreaId[] = settings.mode === "fullscreen" ? ["fullscreen"] : PART_ORDER;
    return `<section class="areas">${ids.map((id) => renderArea(id, settings.areas[id], sources)).join("")}</section>`;
}

function renderSource(source: SourceView): string {
    const detailsId = `source-${source.id}`;
    const missing = source.count === 0;
    const meta = missing
        ? `<span class="error">${icon("error")} ${escapeHtml(t.notFound)}</span>`
        : source.type === "folder"
            ? escapeHtml(format(t.imageCount, source.count))
            : "";
    const thumbnail = source.thumbnail
        ? `<img src="${escapeHtml(source.thumbnail)}" alt="" loading="lazy">`
        : icon(source.type === "folder" ? "folder" : source.type === "url" ? "globe" : "file-media");
    const interval = source.type === "folder"
        ? `<label class="field"><span>${escapeHtml(t.interval)}</span><input type="number" min="0" step="1" value="${source.interval}" data-source="${escapeHtml(source.id)}" data-field="interval"></label>
      <label class="check"><input type="checkbox" data-source="${escapeHtml(source.id)}" data-field="random"${source.random ? " checked" : ""}><span>${escapeHtml(t.random)}</span></label>
      <label class="check"><input type="checkbox" data-source="${escapeHtml(source.id)}" data-field="recursive"${source.recursive ? " checked" : ""}><span>${escapeHtml(t.recursive)}</span></label>`
        : "";
    return `<li class="source${missing ? " missing" : ""}">
  <div class="source-main">
    <div class="thumb">${thumbnail}</div>
    <div class="source-text">
      <div class="source-name">${escapeHtml(source.name)}</div>
      <div class="source-meta"><span class="badge">${escapeHtml(t[`type_${source.type}` as keyof Strings])}</span>${meta}</div>
      <div class="source-path" title="${escapeHtml(source.path)}">${escapeHtml(source.path)}</div>
    </div>
    ${button("", `remove:${source.id}`, { icon: "trash", title: t.remove })}
  </div>
  <details data-details="${escapeHtml(detailsId)}"${openDetails.has(detailsId) ? " open" : ""}>
    <summary>${escapeHtml(t.details)}</summary>
    <div class="details-body">
      <label class="field"><span>${escapeHtml(t.name)}</span><input type="text" value="${escapeHtml(source.name)}" data-source="${escapeHtml(source.id)}" data-field="name"></label>
      ${interval}
    </div>
  </details>
</li>`;
}

function renderSources(current: State): string {
    const list = current.sources.length === 0
        ? `<p class="empty">${escapeHtml(t.noSources)}</p>`
        : `<ul class="sources">${current.sources.map(renderSource).join("")}</ul>`;
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
    const focusKey = active?.dataset.field ? `${active.dataset.area ?? active.dataset.source}|${active.dataset.field}` : active?.dataset.action;
    const scroll = window.scrollY;
    app.innerHTML = [renderStatus(state), renderMode(state.settings.mode), renderAreas(state), renderSources(state), renderTransfer()].join("");
    if (focusKey) {
        const [owner, field] = focusKey.split("|");
        const selector = field
            ? `[data-field="${CSS.escape(field)}"][data-area="${CSS.escape(owner)}"], [data-field="${CSS.escape(field)}"][data-source="${CSS.escape(owner)}"]`
            : `[data-action="${CSS.escape(focusKey)}"]`;
        (app.querySelector(selector) as HTMLElement | null)?.focus();
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
    return input.dataset.field === "source" && value === "" ? null : value;
}

app.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    const action = target?.dataset.action;
    if (!action || !state) {
        return;
    }
    if (action === "toggle") {
        vscode.postMessage({ type: "setEnabled", value: !state.settings.enabled });
    } else if (action.startsWith("mode:")) {
        vscode.postMessage({ type: "setMode", value: action.slice(5) });
    } else if (action.startsWith("cmd:")) {
        vscode.postMessage({ type: "command", command: action.slice(4) });
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

app.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const field = input.dataset.field;
    if (!field) {
        return;
    }
    const patch = { [field]: fieldValue(input) };
    if (input.dataset.area) {
        vscode.postMessage({ type: "updateArea", id: input.dataset.area, patch });
    } else if (input.dataset.source) {
        vscode.postMessage({ type: "updateSource", id: input.dataset.source, patch });
    }
});

app.addEventListener("toggle", (event) => {
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
}, true);

window.addEventListener("message", (event: MessageEvent<{ type: string } & State>) => {
    if (event.data.type === "state") {
        state = event.data;
        render();
    }
});

vscode.postMessage({ type: "ready" });
