import { describe, expect, it } from "vitest";

import { buildPatchBlock, inspectPatch, vscodeChecksum } from "../src/workbench/patch";
import { planApply, planRemove, planRemoveBackImage } from "../src/workbench/plan";

const SCRIPT = "console.log('workbench');";
const product = (checksum: string) =>
  JSON.stringify({ checksums: { "vs/workbench/workbench.desktop.main.js": checksum } }, null, 2);
const { block } = buildPatchBlock("var __ushiroeRuntime={start(){}};", {
  configUrl: "vscode-file://vscode-app/live.json",
  pollInterval: 1500,
});
const BACKIMAGE = "\n//backimage.1.1.6-abc\n;(function(){})();\n//END.backimage.1.1.6";

describe("planApply", () => {
  it("patches the script and points the checksum at the patched script", () => {
    const edit = planApply(
      { script: SCRIPT, product: product(vscodeChecksum(SCRIPT)) },
      block,
      true
    );
    expect(edit.script).toBe(SCRIPT + block);
    expect(edit.product).toBe(product(vscodeChecksum(SCRIPT + block)));
  });

  it("keeps the original checksum when the warning should stay", () => {
    const original = product(vscodeChecksum(SCRIPT));
    const edit = planApply({ script: SCRIPT, product: original }, block, false);
    expect(edit.script).toBe(SCRIPT + block);
    expect(edit.product).toBeUndefined();
  });

  it("changes nothing when the patch is current", () => {
    const patched = SCRIPT + block;
    expect(
      planApply({ script: patched, product: product(vscodeChecksum(patched)) }, block, true)
    ).toEqual({});
  });

  it("tolerates a missing product.json", () => {
    expect(planApply({ script: SCRIPT, product: null }, block, true)).toEqual({
      script: SCRIPT + block,
    });
  });
});

describe("planRemove", () => {
  it("restores the script and its checksum", () => {
    const patched = SCRIPT + block;
    const edit = planRemove({ script: patched, product: product(vscodeChecksum(patched)) });
    expect(edit).toEqual({ script: SCRIPT, product: product(vscodeChecksum(SCRIPT)) });
    expect(inspectPatch(edit.script ?? "").hash).toBeNull();
  });
});

describe("planRemoveBackImage", () => {
  it("strips only BackImage's block", () => {
    const script = SCRIPT + BACKIMAGE + block;
    expect(planRemoveBackImage({ script, product: null })).toEqual({ script: SCRIPT + block });
  });

  it("does not touch the checksum when there is no BackImage block", () => {
    expect(planRemoveBackImage({ script: SCRIPT, product: product("other") })).toEqual({});
  });
});
