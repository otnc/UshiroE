<p align="center">
  <img src="https://raw.githubusercontent.com/otnc/UshiroE/main/resources/icon.png" alt="UshiroE icon" width="128" height="128">
</p>

# UshiroE

**English** | [日本語](README.ja.md)

UshiroE (後ろ絵, "the picture behind") puts background images behind VS Code: one image over the whole window, or separate images for the editor, the side bars and the panel. It is the successor to [BackImage](https://github.com/ro80t/BackImage), rebuilt for current versions of VS Code, and it can import your BackImage settings.

## Features

- **Full window or per part**: the editor, the primary side bar, the secondary side bar (where Chat lives) and the panel can each have their own image.
- **Live updates**: changing an image, the opacity, the fit or the blur takes effect within a couple of seconds. No reload is needed, apart from a single restart when the patch is first installed.
- **Folders and URLs**: a folder rotates through its images at a fixed interval, in order or at random, optionally including subfolders. New files in the folder are picked up automatically. `https://` image URLs work too.
- **Fit, position and blur** per area, and a cross-fade when images change.
- **Next Image** command to skip to the next image right away.
- **Import from BackImage**, plus export and import of UshiroE's own settings as JSON.
- **Safe patching**: no full copies of VS Code's files are kept. The patch is a marked block that is removed exactly, so restoring never brings back a stale file from an older VS Code version.
- **Survives updates**: after VS Code updates, the patch is re-applied automatically.

## Getting started

1. Open the UshiroE view from the activity bar.
2. Add an image with **File**, **Folder** or **URL**.
3. Choose the image for the full window, or switch the mode to **Per part** and pick images for the parts you want.
4. Press **Turn On**. The first time, UshiroE asks for permission to patch VS Code. Restart VS Code once (quit it and open it again) and the background appears.

After that, changes in the view or in `settings.json` show up without restarting.

## Moving from BackImage

1. Install UshiroE. If BackImage is installed, UshiroE offers to import its settings. You can also run **UshiroE: Import Settings from BackImage** from the Command Palette at any time.
2. After the import, UshiroE offers to uninstall BackImage. Accept it, because both extensions patch the same file and would conflict. UshiroE also removes BackImage's patch and the `.backup` files it left in VS Code's installation folder.
3. Restart VS Code.

Image lists become image sources, and the selected images, part settings, random order and intervals carry over. BackImage's full-screen opacity described how opaque the UI was, while UshiroE's describes how visible the image is, so that value is converted (BackImage's 0.85 becomes 0.15). Like BackImage, backgrounds stay off when no background type was selected in BackImage.

## Settings

| Setting | Description |
| --- | --- |
| `ushiroe.enabled` | Show background images. |
| `ushiroe.mode` | `fullscreen` for one image over the window, `parts` for separate images per part. |
| `ushiroe.sources` | Image sources: `file`, `folder` or `url`, with `random`, `interval` (seconds) and `recursive` for folders. |
| `ushiroe.fullscreen` | Image, opacity, fit, position and blur for the full window. |
| `ushiroe.editor`, `ushiroe.sidebar`, `ushiroe.auxiliaryBar`, `ushiroe.panel` | The same, plus `enabled`, for each part. |
| `ushiroe.transition` | Seconds the cross-fade between images takes. |
| `ushiroe.patch.hideCorruptWarning` | Update VS Code's checksum so it does not report the installation as corrupt. |
| `ushiroe.patch.autoRepair` | Re-apply the patch automatically after VS Code updates. |

Supported image formats are PNG, JPEG, GIF, BMP, SVG and WebP. These are the formats VS Code serves from any folder on disk.

## How it works

VS Code has no API for changing its own appearance, so UshiroE appends a small script to `workbench.desktop.main.js` in VS Code's installation folder. The script reads a settings file that UshiroE keeps in its global storage folder and checks it every couple of seconds, which is why most changes apply without a restart. Changing the patch itself needs a full restart, because VS Code keeps the workbench script cached until it quits.

If VS Code is installed in a folder you cannot write to, UshiroE asks for administrator rights once.

## Uninstalling

Run **UshiroE: Remove Patch from VS Code** before uninstalling, then restart VS Code. If you forget, UshiroE's uninstall hook removes the patch the next time VS Code starts after the uninstall.

## Notes

- VS Code may show "\[Unsupported]" in the title bar or a notice that the installation is corrupt. `ushiroe.patch.hideCorruptWarning` (on by default) updates VS Code's checksum to prevent this.
- UshiroE only works in desktop VS Code. In remote sessions (SSH, WSL, Dev Containers) it runs on your local machine, and images must be on your local machine.
- If something goes wrong, run **UshiroE: Remove Patch from VS Code**. Reinstalling VS Code also restores it completely.

## License

[MIT](LICENSE)
