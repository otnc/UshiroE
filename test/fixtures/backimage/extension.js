// Test double for BackImage 1.1.6 (ROBOTofficial.backimage): on every activation it saves backups when they are missing and otherwise restores the workbench from them, with plain non-atomic writes, which is what made it fight with UshiroE.
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

function activate() {
  const dir = path.join(vscode.env.appRoot, "out", "vs", "workbench");
  const js = path.join(dir, "workbench.desktop.main.js");
  const css = path.join(dir, "workbench.desktop.main.css");
  if (!fs.existsSync(`${js}.backup`) || !fs.existsSync(`${css}.backup`)) {
    fs.writeFileSync(`${js}.backup`, fs.readFileSync(js));
    fs.writeFileSync(`${css}.backup`, fs.readFileSync(css));
    return;
  }
  const backup = fs.readFileSync(`${js}.backup`);
  if (!backup.equals(fs.readFileSync(js))) {
    fs.writeFileSync(js, backup);
  }
}

module.exports = { activate, deactivate() {} };
