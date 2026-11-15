<p align="center">
  <img src="https://raw.githubusercontent.com/otnc/UshiroE/main/resources/icon.png" alt="UshiroE icon" width="128" height="128">
</p>

# UshiroE

**English** | [日本語](README.ja.md)

UshiroE (後ろ絵) adds background images to VS Code. Set one for the entire window or choose separate images for the editor, side bars, and panel. UshiroE is the successor to [BackImage](https://github.com/ro80t/BackImage) and can import its settings.

## Features

- **Full window or per area**: Set a separate image for the editor, each side bar, and the panel, or use one image for the entire window.
- **Live updates**: Changes to images and appearance take effect within a few seconds. Restart VS Code when you first apply the patch.
- **Folders and URLs**: Cycle through a folder's images in order or at random, with the option to include subfolders. Download images from `http://` or `https://` URLs once or at every startup.
- **Local image copies**: UshiroE keeps its own copies, so you can move or delete the originals without losing your backgrounds.
- **Presets and image rotation**: Make your own image lists. Choose the order, then switch images on a timer or only at startup.
- **Appearance**: Set the opacity, fit, position, and blur for each area. Images crossfade on change and never cover the title bar.
- **Next Image**: Advance the images in all visible areas that have more than one image.
- **Import and export**: Import BackImage settings, or transfer UshiroE's background settings as JSON.
- **Removable patch**: Removing the patch deletes only the marked block UshiroE added to VS Code's workbench script.
- **Automatic repair**: When backgrounds and automatic repair are enabled, UshiroE checks for a missing or outdated patch at startup.

## Getting started

1. Open the UshiroE view from the activity bar.
2. Add images with **File**, **Folder**, or **URL**.
3. Choose a background in **Full window** mode, or select **Per area**, check each area you want to use, and choose its image.
4. Click **Turn On** and confirm the patch when prompted. If UshiroE applies a patch, quit and reopen VS Code to see the background.

Changes in the view or in `settings.json` take effect without restarting once the patch is active.

## Moving from BackImage

1. Install UshiroE. If you have no UshiroE sources or presets yet, the extension offers to import when it finds BackImage or its backups. You can also run **UshiroE: Import Settings from BackImage** from the Command Palette and select a profile if prompted.
2. When prompted after the import, uninstall BackImage. Both extensions patch the same VS Code file.
3. Quit and reopen VS Code to finish unloading BackImage. If the imported settings have backgrounds turned on, UshiroE can then apply its patch. If BackImage left `.backup` files, UshiroE asks for permission to delete them first. If backgrounds are off, click **Turn On** when you're ready.

UshiroE leaves VS Code's files unchanged while BackImage is active. The `ushiroe.backImage.priority` setting controls which extension manages the background:

- `ushiroe` (default): UshiroE shows a warning with **Uninstall BackImage**, **Disable BackImage** and **Let BackImage Take Over**.
- `backImage`: BackImage manages the background while it is active. UshiroE leaves VS Code's files unchanged and skips automatic repairs until BackImage is inactive.

UshiroE imports image lists as image sources and preserves the selected backgrounds, per-area settings, random order, and switching intervals. BackImage's full-window setting controls the opacity of the UI over the image, so UshiroE converts it to image opacity: `0.85` becomes `0.15`. If no background type was selected in BackImage, the background stays off. UshiroE copies imported images into its image folder.

## Image folder

UshiroE copies images from files, folders, URLs, and BackImage into its image folder. By default, this is `UshiroE` in your Pictures folder. Each entry in the **Images** list is an image source and gets its own subfolder. Copies use short ASCII filenames to avoid path encoding problems. Your backgrounds still work if you move or delete the originals.

- For local files and folders, UshiroE copies the images when you add the source. The original location is displayed as **Imported from**.
- To add more images to a file or folder source, use **Add Images** in its details or use **Open Folder** and copy files into that subfolder. For a URL source, use **Download Again** to refresh the image. Re-importing a source or downloading it again replaces the images in that source's subfolder.
- In the **Image folder** section, click **Change** to pick a different folder, or **Use Default** to switch back. You can also set `ushiroe.libraryFolder` directly. In a new folder, UshiroE imports each source from its original path or URL. Images added directly to a source and changes to its image order stay in the previous folder.
- Deleting an image from a source folder removes it from the background. Removing a source deletes its whole subfolder if it has a `manifest.json` file, including images you added directly.

## Presets and image rotation

Under **Image** for each area, select a source, a preset, or **All images**. In the view, each source's rotation controls appear in its details once it has at least two images.

- **Order**: from top to bottom, or random.
- **Switch interval**: Time in seconds between images. Set it to `0` to turn off timed rotation.
- **Switch only at VS Code startup**: Advance to the next image or choose one at random when VS Code starts.

A preset is an ordered list of images you choose. Click **New Preset**, give it a name, and select the images under **Add Images**. Use the arrows to reorder them. You can create as many presets as you like.

In sequential mode, **All images** follows the order of sources in the **Images** list, then the order of images within each source. Use the arrows to change either order. A source and **All images** each show up to 2,000 images.

## Settings

| Setting | Description |
| --- | --- |
| `ushiroe.enabled` | Show background images. |
| `ushiroe.mode` | `fullscreen` for one image over the window, `parts` for separate images by area. |
| `ushiroe.sources` | Image sources: `file`, `folder`, or `url`. Sources can set `random`, `interval` (seconds), and `changeOnStartupOnly`. Folder sources also support `recursive`; URL sources support `refresh` (`never` or `startup`). |
| `ushiroe.fullscreen` | Image, opacity, fit, position and blur for the full window. Select a source ID, `*` for all images, or `preset:<id>` for a preset. |
| `ushiroe.editor`, `ushiroe.sidebar`, `ushiroe.auxiliaryBar`, `ushiroe.panel` | Per-area background settings, including an `enabled` switch. |
| `ushiroe.transition` | Crossfade duration in seconds. |
| `ushiroe.allImages` | Rotation settings for **All images** (`*`): `random`, `interval` (seconds) and `changeOnStartupOnly`. |
| `ushiroe.presets` | Named image lists with their own rotation settings. |
| `ushiroe.libraryFolder` | Folder for the image copies; empty means `UshiroE` in your Pictures folder. |
| `ushiroe.backImage.priority` | Who manages the background while BackImage is active: `ushiroe` (default) or `backImage`. |
| `ushiroe.patch.hideCorruptWarning` | Update the verified workbench file's checksum when applying the patch to suppress the integrity warning. |
| `ushiroe.patch.autoRepair` | Try to reapply a missing or outdated patch at startup when backgrounds are enabled. |

Supported image formats: PNG, JPEG, GIF, BMP, SVG, and WebP.

**Export Settings** saves background settings, including source paths and preset references. To move your setup to another machine, keep the image files and library separately. Set the image folder location and patch options on the destination machine.

## How it works

UshiroE adds a small script to `workbench.desktop.main.js` in the VS Code installation folder. The script reads UshiroE's settings from its global storage folder every few seconds, so most changes apply without a restart. VS Code caches the workbench script until it quits, so changes to the patch require you to quit and reopen VS Code.

If VS Code is installed in a folder you cannot write to, UshiroE asks for administrator rights once.

## Uninstalling

Run **UshiroE: Remove Patch from VS Code** before uninstalling, then restart VS Code. UshiroE's uninstall hook also attempts to remove the patch. If the patch is still there when you reinstall UshiroE, the extension asks whether to remove it.

## Notes

- Patching can trigger VS Code's integrity warning. The `ushiroe.patch.hideCorruptWarning` setting is on by default and updates the checksum when UshiroE applies the patch.
- UshiroE only works in desktop VS Code. In remote sessions (SSH, WSL, Dev Containers) it runs on your local machine, and images must be on your local machine.
- If something goes wrong, see [Troubleshooting](#troubleshooting).

## Troubleshooting

UshiroE uses a lock to prevent two windows from patching the same VS Code installation at once. It checks that the workbench script is an original VS Code file or has a recognized patch, then writes the changes atomically and verifies them. It leaves VS Code's files alone while BackImage is active. UshiroE tries automatic repair once per VS Code build. Running **UshiroE: Repair Patch** resets that limit. UshiroE never reloads or restarts VS Code on its own.

**"Your Code installation appears to be corrupt", or the window keeps reloading**

1. Uninstall any other extensions that patch VS Code. For BackImage, run `code --uninstall-extension robotofficial.backimage`.
2. Run **UshiroE: Restore VS Code Workbench**. It restores a verified backup if one is available, or removes the UshiroE patch from a workbench file it recognizes.
3. Restart VS Code.

**VS Code does not start**

Run UshiroE's recovery script with Node.js, passing VS Code's install folder (on Windows usually `%LOCALAPPDATA%\Programs\Microsoft VS Code`):

```sh
node ~/.vscode/extensions/otoneko1102.ushiroe-<version>/dist/uninstall.js "<VS Code install folder>"
```

The script restores the saved workbench file if its checksum matches the recorded original. Otherwise, it removes UshiroE's patch when it can verify the unpatched file. If it cannot verify the file, reinstall VS Code. Run the script as an administrator if VS Code is installed for all users.

## Known issues

**VS Code signed you out of GitHub.** Sign in again. On Windows, VS Code 1.146 stores GitHub credentials in `~/.vscode-shared/sharedStorage/state.vscdb`, which VS Code instances under the same Windows account share. An instance with a different `--user-data-dir` can delete credentials it cannot decrypt. Keep `~/.vscode-shared`: it also stores Workspace Trust and recent folders. UshiroE does not access this folder. See the [investigation](docs/investigations/github-signout.md).

## Contributing

See the [contributing guide](CONTRIBUTING.md) for build, test, and release instructions.

## License

[MIT](LICENSE)
