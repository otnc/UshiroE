/**
 * Startup repair bookkeeping. UshiroE re-applies a lost patch at most once per VS Code commit: a VS Code update legitimately removes it once, but losing it again means something else keeps overwriting the workbench, and repairing again would start a loop.
 */
export interface RepairRecord {
  commit: string;
  /** Automatic repairs done for this commit. */
  count: number;
  lastStartupRepairAt: number;
  /** The "repair stopped" warning was already shown for this commit. */
  warned: boolean;
}

export type RepairDecision =
  | { action: "none"; record: RepairRecord | undefined }
  | { action: "repair"; record: RepairRecord }
  /** Stop repairing; `warn` is true only the first time, so the warning shows once. */
  | { action: "stop"; warn: boolean; record: RepairRecord };

export const MAX_AUTO_REPAIRS_PER_COMMIT = 1;

export function decideStartupRepair(
  previous: RepairRecord | undefined,
  commit: string,
  patchMissing: boolean,
  now: number
): RepairDecision {
  if (!patchMissing) {
    return { action: "none", record: previous };
  }
  const base: RepairRecord =
    previous?.commit === commit
      ? previous
      : { commit, count: 0, lastStartupRepairAt: 0, warned: false };
  if (base.count >= MAX_AUTO_REPAIRS_PER_COMMIT) {
    return { action: "stop", warn: !base.warned, record: { ...base, warned: true } };
  }
  return {
    action: "repair",
    record: { ...base, count: base.count + 1, lastStartupRepairAt: now },
  };
}

/** A manual repair means the user dealt with the cause, so automatic repairs may resume. */
export function resetRepairs(commit: string): RepairRecord {
  return { commit, count: 0, lastStartupRepairAt: 0, warned: false };
}
