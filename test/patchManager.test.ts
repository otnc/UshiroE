import type { ExtensionContext } from "vscode";
import { beforeEach, expect, it, vi } from "vitest";

import { PatchManager } from "../src/patchManager";
import type { PatchStatus, Patcher } from "../src/patcher";

const { showWarningMessage, showInformationMessage, settings } = vi.hoisted(() => ({
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  settings: { enabled: true, autoRepair: true },
}));

vi.mock("vscode", () => ({
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
  },
  extensions: { getExtension: () => undefined },
  l10n: { t: (message: string) => message },
  window: { showWarningMessage, showInformationMessage },
}));

vi.mock("../src/settings", () => ({
  readSettings: () => ({ enabled: settings.enabled }),
  readPatchOptions: () => ({ autoRepair: settings.autoRepair, backImagePriority: "ushiroe" }),
}));

const outdatedStatus: PatchStatus = {
  state: "outdated",
  blockHash: "old",
  hasBackImage: false,
  hasBackImageBackups: false,
  problem: null,
  commit: "same-vscode-build",
};

function setup(previousWarning = false) {
  const stored = new Map<string, unknown>([["patchConsent", true]]);
  if (previousWarning) {
    stored.set("startupRepair", { commit: outdatedStatus.commit, count: 1, warned: true });
  }
  const context = {
    globalState: {
      get: (key: string) => stored.get(key),
      update: async (key: string, value: unknown) => void stored.set(key, value),
    },
  } as unknown as ExtensionContext;
  const status = vi.fn().mockResolvedValue(outdatedStatus);
  const apply = vi.fn(async () => {
    status.mockResolvedValue({ ...outdatedStatus, state: "applied" });
    return true;
  });
  return { patch: new PatchManager(context, { apply, status } as unknown as Patcher), apply };
}

beforeEach(() => {
  settings.enabled = true;
  settings.autoRepair = true;
  showWarningMessage.mockReset().mockResolvedValue(undefined);
  showInformationMessage.mockReset().mockResolvedValue(undefined);
});

it("offers repair for an older patch even when the startup repair warning was already shown", async () => {
  const { patch, apply } = setup(true);
  await patch.ensure("startup");
  expect(apply).not.toHaveBeenCalled();
  expect(showWarningMessage).toHaveBeenCalledWith(
    expect.stringContaining("out of date"),
    "Repair Patch"
  );
});

it("repairs the patch and prompts for a restart when the warning action is selected", async () => {
  const { patch, apply } = setup();
  settings.autoRepair = false;
  showWarningMessage.mockResolvedValueOnce("Repair Patch");
  await patch.ensure("startup");
  await vi.waitFor(() => expect(patch.restartPending).toBe(true));
  expect(apply).toHaveBeenCalledOnce();
  expect(showInformationMessage).toHaveBeenCalledWith(
    expect.stringContaining("Quit and reopen"),
    "Quit VS Code"
  );
});
