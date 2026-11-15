/** Which extension owns the workbench files when BackImage is around. */
export const BACKIMAGE_PRIORITIES = ["ushiroe", "backImage"] as const;
export type BackImagePriority = (typeof BACKIMAGE_PRIORITIES)[number];

export interface BackImagePresence {
  /** BackImage's code is loaded in this session, so it can write the workbench files. */
  active: boolean;
  /** BackImage's block is in the workbench script. */
  hasBlock: boolean;
  /** BackImage's `.backup` files are next to the workbench files. */
  hasBackups: boolean;
}

export type Ownership =
  /** UshiroE may write. `cleanupBackImage` asks to remove BackImage's leftovers first. */
  | { kind: "ushiroe"; cleanupBackImage: boolean; priorityIgnored: boolean }
  /** UshiroE should own the workbench, but an active BackImage would fight it: write nothing. */
  | { kind: "conflict" }
  /** The user let BackImage manage the workbench: write nothing and skip repairs. */
  | { kind: "backImage" };

export function decideOwnership(
  priority: BackImagePriority,
  presence: BackImagePresence
): Ownership {
  if (presence.active) {
    return priority === "backImage" ? { kind: "backImage" } : { kind: "conflict" };
  }
  return {
    kind: "ushiroe",
    cleanupBackImage: presence.hasBlock || presence.hasBackups,
    // BackImage is not there to take over, so the setting has no effect.
    priorityIgnored: priority === "backImage",
  };
}

export function canWrite(ownership: Ownership): boolean {
  return ownership.kind === "ushiroe";
}
