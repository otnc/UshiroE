<p align="center">
  <img src="https://raw.githubusercontent.com/otnc/UshiroE/main/resources/icon.png" alt="UshiroE icon" width="128" height="128">
</p>

# UshiroE

**English** | [日本語](README.ja.md)

UshiroE (後ろ絵, "the picture behind") puts background images behind VS Code: one image over the whole window, or separate images for the editor, the side bars and the panel. It is the successor to [BackImage](https://github.com/ro80t/BackImage), rebuilt for current versions of VS Code, and it can import your BackImage settings.

## Features

- **Full window or per part**: the editor, the primary side bar, the secondary side bar (where Chat lives) and the panel can each have their own image.
- **Live updates**: changing an image, the opacity, the fit or the blur takes effect within a couple of seconds. No reload is needed, apart from a single restart when the patch is first installed.
- **Folders and URLs**: a folder's images rotate at a fixed interval, in order or at random, optionally including subfolders. Images from `http://` and `https://` URLs are downloaded once or again at every startup.
- **One image folder**: every image is copied into `UshiroE` in your Pictures folder (or a folder you choose) under a short ASCII name when you add it, so paths with Japanese or other non-ASCII characters never cause trouble, and the background stays when the original is moved or deleted.
- **Presets and order**: build presets, your own lists of images, and put the sources and their images in the order you like. Any of them can play from top to bottom or at random, on a timer or only when VS Code starts.
- **Fit, position and blur** per area, and a cross-fade when images change. The title bar with the menus always stays clear.
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
2. After the import, UshiroE offers to uninstall BackImage. Accept it, because both extensions patch the same file and would conflict.
3. Restart VS Code. BackImage keeps running until then, so UshiroE changes nothing before the restart. After it, UshiroE asks to delete the `.backup` files BackImage left in VS Code's installation folder and applies its patch.

While BackImage is active, UshiroE never writes VS Code's files. `ushiroe.backImage.priority` decides what happens then:

- `ushiroe` (default): UshiroE shows a warning with **Uninstall BackImage**, **Disable BackImage** and **Let BackImage Take Over**.
- `backImage`: BackImage manages the background and UshiroE stays out of the way, including its automatic repair. Once BackImage is gone, UshiroE takes over again.

Image lists become image sources, and the selected images, part settings, random order and intervals carry over. BackImage's full-screen opacity described how opaque the UI was, while UshiroE's describes how visible the image is, so that value is converted (BackImage's 0.85 becomes 0.15). Like BackImage, backgrounds stay off when no background type was selected in BackImage. Imported images are copied into the image folder like any other image.

## Image folder

UshiroE never shows your original files directly. Every image, whether it comes from a file, a folder, a URL or BackImage, is copied into `UshiroE` in your Pictures folder, with one subfolder per source and short ASCII file names. This avoids trouble with paths that contain Japanese or other non-ASCII characters, and the background keeps working when the original is moved or deleted.

- Images are copied once, when you add them. After that the source no longer depends on the original file or folder, which is only shown as "Imported from" in the source's details.
- To add images to a source, use **Add Images** in its details, or put image files into its subfolder (**Open Folder**). Deleting a file there removes it from the background.
- Use **Change** in the view's Image folder section (or `ushiroe.libraryFolder`) to pick another folder, and **Use Default** to go back. The old folder is left as it is.
- Only subfolders UshiroE created (they contain a `manifest.json`) are ever deleted, so other files you keep there are safe.

## Presets and order

Each area's **Image** can be a source, a preset, or **All images**. All three take turns the same way:

- **Order**: from top to bottom, or random.
- **Change every**: seconds between images; 0 keeps the same image.
- **Change only when VS Code starts**: no timer; each start shows the next image, or a random one.

**Presets** are your own lists of images. Press **New Preset**, give it a name, open **Add Images** in the preset and click the images you want. Use the arrows to change the order. You can make as many presets as you like.

**All images** plays every source's images in the order of the **Images** list: the sources from top to bottom (use the arrows next to each source), and inside each source the order shown in its details.

## Settings

| Setting | Description |
| --- | --- |
| `ushiroe.enabled` | Show background images. |
| `ushiroe.mode` | `fullscreen` for one image over the window, `parts` for separate images per part. |
| `ushiroe.sources` | Image sources: `file`, `folder` or `url`, with `random`, `interval` (seconds) and `recursive` for folders and `refresh` (`never` or `startup`) for URLs. |
| `ushiroe.fullscreen` | Image, opacity, fit, position and blur for the full window. The image is a source id, `*` for all images, or `preset:<id>`. Sources also have `changeOnStartupOnly`. |
| `ushiroe.editor`, `ushiroe.sidebar`, `ushiroe.auxiliaryBar`, `ushiroe.panel` | The same, plus `enabled`, for each part. |
| `ushiroe.transition` | Seconds the cross-fade between images takes. |
| `ushiroe.allImages` | How All images (`*`) takes turns: `random`, `interval` (seconds) and `changeOnStartupOnly`. |
| `ushiroe.presets` | Your presets: a name, the images in order, and the same three settings. |
| `ushiroe.libraryFolder` | Folder for the image copies; empty means `UshiroE` in your Pictures folder. |
| `ushiroe.backImage.priority` | Who manages the background while BackImage is active: `ushiroe` (default) or `backImage`. |
| `ushiroe.patch.hideCorruptWarning` | Update VS Code's checksum so it does not report the installation as corrupt. |
| `ushiroe.patch.autoRepair` | Re-apply the patch automatically after VS Code updates. |

Supported image formats are PNG, JPEG, GIF, BMP, SVG and WebP. These are the formats VS Code serves from any folder on disk.

## How it works

VS Code has no API for changing its own appearance, so UshiroE appends a small script to `workbench.desktop.main.js` in VS Code's installation folder. The script reads a settings file that UshiroE keeps in its global storage folder and checks it every couple of seconds, which is why most changes apply without a restart. Changing the patch itself needs a full restart, because VS Code keeps the workbench script cached until it quits.

If VS Code is installed in a folder you cannot write to, UshiroE asks for administrator rights once.

## Uninstalling

Run **UshiroE: Remove Patch from VS Code** before uninstalling, then restart VS Code. If you forget, UshiroE's uninstall hook removes the patch the next time VS Code starts after the uninstall. If the patch is still there when you install UshiroE again, UshiroE asks whether to remove it before doing anything else.

## Notes

- VS Code may show "\[Unsupported]" in the title bar or a notice that the installation is corrupt. `ushiroe.patch.hideCorruptWarning` (on by default) updates VS Code's checksum to prevent this.
- UshiroE only works in desktop VS Code. In remote sessions (SSH, WSL, Dev Containers) it runs on your local machine, and images must be on your local machine.
- If something goes wrong, see [Troubleshooting](#troubleshooting).

## Troubleshooting

UshiroE only writes VS Code's files when no other patcher is active, under a lock shared by all windows, with atomic and verified writes, and only on files it recognizes as VS Code's own or its own earlier patch. It re-applies a lost patch at most once per VS Code version and never reloads or restarts VS Code by itself.

**"Your Code installation appears to be corrupt", or the window keeps reloading**

1. Uninstall BackImage or any other extension that patches VS Code: `code --uninstall-extension robotofficial.backimage`.
2. Run **UshiroE: Restore VS Code Workbench**. It writes back the copy of VS Code's file that UshiroE saved before its first patch, and VS Code's own checksum.
3. Restart VS Code.

**VS Code does not start**

Run UshiroE's recovery script with Node.js, passing VS Code's install folder (on Windows usually `%LOCALAPPDATA%\Programs\Microsoft VS Code`):

```sh
node ~/.vscode/extensions/otoneko1102.ushiroe-<version>/dist/uninstall.js "<VS Code install folder>"
```

It restores the saved copy when its hash matches, otherwise removes UshiroE's patch, and tells you to reinstall VS Code when the file was changed by something else. Run it as administrator if VS Code is installed for all users. Reinstalling VS Code is the last resort and always works.

## Known issues

**GitHub or another sign-in is gone.** Sign in again. Since VS Code 1.146, the GitHub token is stored in `~/.vscode-shared/sharedStorage/state.vscdb`, which every VS Code on your OS account shares. Starting a second VS Code with its own `--user-data-dir` (for example a portable copy or a test instance) deletes that token, because VS Code removes secrets it cannot decrypt. Do not delete `~/.vscode-shared` to fix sign-in problems; it also holds Workspace Trust and recent folders. UshiroE never reads or writes this folder. See [the investigation](docs/investigations/github-signout.md).

## Development

| Command | What it does |
| --- | --- |
| `npm run build` | Bundles the extension into `dist/`. |
| `npm run check-types`, `npm run lint`, `npm run format:check` | Type checks, lints and checks formatting. |
| `npm test` | Runs the unit tests. |
| `npm run test:integration` | Runs the integration tests in a downloaded VS Code. |
| `npm run vsix` | Builds `ushiroe.vsix`. |
| `npm run vsix:install` | Builds `ushiroe.vsix` and installs it into your VS Code with `code --install-extension`. |
| `npm run docs:build` | Regenerates `README.md` and `README.ja.md` from `base/README.base.md`. |
| `npm run changelog:preview` | Shows the changelog entry the next release will get. |

Releases are made with the `release` workflow. `CHANGELOG.md` is generated from Conventional Commits by git-cliff, so PR titles must follow that format (`feat: ...`, `fix: ...`); they become the squash commit messages.

> [!WARNING]
> Never start a second VS Code with its own `--user-data-dir` on your own OS account to try UshiroE out. It shares `~/.vscode-shared` with your normal VS Code and deletes your GitHub sign-in (see [Known issues](#known-issues)). Use `npm run test:integration`, which runs with in-memory storage, or test on a separate OS account or a VM.

## License

[MIT](LICENSE)
