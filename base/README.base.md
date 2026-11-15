<p align="center">
  <img src="https://raw.githubusercontent.com/otnc/UshiroE/main/resources/icon.png" alt="UshiroE icon" width="128" height="128">
</p>

# UshiroE

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install-007ACC)](https://marketplace.visualstudio.com/items?itemName=otoneko1102.ushiroe)
[![Latest release](https://img.shields.io/github/v/release/otnc/UshiroE)](https://github.com/otnc/UshiroE/releases/latest)
[![CI](https://github.com/otnc/UshiroE/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/otnc/UshiroE/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

:::kiritan{locale=en}
UshiroE (後ろ絵) adds background images to VS Code. Set one for the entire window or choose separate images for the editor, side bars, and panel. UshiroE is an unofficial successor to [BackImage](https://github.com/ro80t/BackImage) and can import its settings.

**[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=otoneko1102.ushiroe)**
:::
:::kiritan{locale=ja}
UshiroE（後ろ絵）は、VS Code に背景画像を設定できる拡張機能です。ウィンドウ全体に 1 枚の画像を表示するか、エディターやサイドバー、パネルに別々の画像を設定できます。[BackImage](https://github.com/ro80t/BackImage) の後継（非公式）で、BackImage の設定もインポートできます。

**[VS Code Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=otoneko1102.ushiroe)**
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## 機能

- **ウィンドウ全体・エリア別**：ウィンドウ全体に 1 枚の画像を表示するか、エディター、プライマリ サイドバー、セカンダリ サイドバー、パネルにそれぞれ設定できます。
- **設定をすぐに反映**：画像や表示設定を変えると数秒で反映されます。パッチの初回適用時は VS Code の再起動が必要です。
- **フォルダと URL**：フォルダ内の画像を順番またはランダムに切り替えられます。サブフォルダも対象にできます。`http://` や `https://` の画像は、追加時に 1 回だけダウンロードするか、起動するたびにダウンロードするかを選べます。
- **画像のコピーを保存**：UshiroE 専用のフォルダに画像をコピーするので、元の画像を移動・削除しても背景は表示されます。
- **プリセットと画像の切り替え**：好きな画像を並べてプリセットを作れます。画像の順番を変えたり、一定間隔または起動時だけ切り替えたりできます。
- **表示設定**：エリアごとに不透明度、フィット、位置、ぼかしを設定できます。画像はクロスフェードで切り替わり、タイトルバーには重なりません。
- **次の画像**：表示中のエリアのうち、画像が複数あるものをまとめて切り替えます。
- **インポートとエクスポート**：BackImage の設定をインポートできます。UshiroE の背景設定は JSON で書き出して読み込めます。
- **パッチの削除**：VS Code のワークベンチスクリプトから、UshiroE が追加したブロックだけを取り除きます。
- **自動修復**：背景表示と自動修復がオンなら、起動時にパッチが消えているか、古くなっていないかを確認して修復します。
:::

:::kiritan{locale=en}
## Getting started

1. Open the UshiroE view from the activity bar.
2. Add images with **File**, **Folder**, or **URL**.
3. Choose a background in **Full window** mode, or select **Per area**, check each area you want to use, and choose its image.
4. Click **Turn On** and confirm the patch when prompted. If UshiroE applies a patch, quit and reopen VS Code to see the background.

Changes in the view or in `settings.json` take effect without restarting once the patch is active.
:::
:::kiritan{locale=ja}
## 使い方

1. アクティビティバーから UshiroE のビューを開きます。
2. **ファイル**、**フォルダ**、**URL** のいずれかで画像を追加します。
3. **ウィンドウ全体** の背景を選びます。場所ごとに変えたいときは、**エリア別** に切り替え、背景を表示したいエリアにチェックを入れて画像を選びます。
4. **オンにする** を押し、初回はパッチの適用を許可します。パッチを適用したら、VS Code を終了して開き直してください。

パッチを適用したあとは、ビューや `settings.json` の変更が再起動なしで反映されます。
:::

:::kiritan{locale=en}
## Moving from BackImage

1. Install UshiroE. If you have no UshiroE sources or presets yet, the extension offers to import when it finds BackImage or its backups. You can also run **UshiroE: Import Settings from BackImage** from the Command Palette and select a profile if prompted.
2. When prompted after the import, uninstall BackImage. Both extensions patch the same VS Code file.
3. Quit and reopen VS Code to finish unloading BackImage. If the imported settings have backgrounds turned on, UshiroE can then apply its patch. If BackImage left `.backup` files, UshiroE asks for permission to delete them first. If backgrounds are off, click **Turn On** when you're ready.

UshiroE leaves VS Code's files unchanged while BackImage is active. The `ushiroe.backImage.priority` setting controls which extension manages the background:

- `ushiroe` (default): UshiroE shows a warning with **Uninstall BackImage**, **Disable BackImage** and **Let BackImage Take Over**.
- `backImage`: BackImage manages the background while it is active. UshiroE leaves VS Code's files unchanged and skips automatic repairs until BackImage is inactive.

UshiroE imports image lists as image sources and preserves the selected backgrounds, per-area settings, random order, and switching intervals. BackImage's full-window setting controls the opacity of the UI over the image, so UshiroE converts it to image opacity: `0.85` becomes `0.15`. If no background type was selected in BackImage, the background stays off. UshiroE copies imported images into its image folder.
:::
:::kiritan{locale=ja}
## BackImage からの移行

1. UshiroE をインストールします。画像ソースもプリセットもまだ登録していない場合、BackImage またはそのバックアップが見つかると、設定のインポートを案内します。コマンドパレットの **UshiroE: BackImage から設定をインポート** からも実行できます。プロファイルの選択画面が出たら、インポート元を選んでください。
2. インポート後の案内に沿って BackImage をアンインストールします。両方の拡張機能が同じファイルにパッチを適用するためです。
3. VS Code を終了して開き直すと、BackImage が停止します。インポートした設定で背景がオンなら、UshiroE がパッチを適用します。BackImage の `.backup` ファイルが残っている場合は、先に削除してよいか確認します。背景がオフの場合は、使い始めるときに **オンにする** を押してください。

BackImage が動作中は、UshiroE は VS Code のファイルを変更しません。どちらが背景を管理するかは、`ushiroe.backImage.priority` で選べます。

- `ushiroe`（既定）：BackImage が動作中は警告が表示されます。**BackImage をアンインストール**、**BackImage を無効化**、**BackImage に任せる** から選んでください。
- `backImage`：BackImage が動作中は背景の管理を任せます。その間、UshiroE はパッチを適用したり修復したりしません。

BackImage の画像リストは画像ソースとしてインポートされます。選択中の画像、エリア別の設定、ランダム表示、切り替え間隔も引き継ぎます。BackImage のウィンドウ全体の設定は UI の不透明度なので、インポート時に画像の不透明度へ変換します。たとえば、`0.85` は `0.15` になります。BackImage で背景の種類を選んでいなければ、背景はオフのままです。インポートした画像は画像フォルダにコピーします。
:::

:::kiritan{locale=en}
## Image folder

UshiroE copies images from files, folders, URLs, and BackImage into its image folder. By default, this is `UshiroE` in your Pictures folder. Each entry in the **Images** list is an image source and gets its own subfolder. Copies use short ASCII filenames to avoid path encoding problems. Your backgrounds still work if you move or delete the originals.

- For local files and folders, UshiroE copies the images when you add the source. The original location is displayed as **Imported from**.
- To add more images to a file or folder source, use **Add Images** in its details or use **Open Folder** and copy files into that subfolder. For a URL source, use **Download Again** to refresh the image. Re-importing a source or downloading it again replaces the images in that source's subfolder.
- In the **Image folder** section, click **Change** to pick a different folder, or **Use Default** to switch back. You can also set `ushiroe.libraryFolder` directly. In a new folder, UshiroE imports each source from its original path or URL. Images added directly to a source and changes to its image order stay in the previous folder.
- Deleting an image from a source folder removes it from the background. Removing a source deletes its whole subfolder if it has a `manifest.json` file, including images you added directly.
:::
:::kiritan{locale=ja}
## 画像フォルダ

UshiroE は、ファイル、フォルダ、URL、BackImage から追加した画像を画像フォルダに保存します。既定の保存先はピクチャフォルダ内の `UshiroE` です。**画像** 一覧の各項目を画像ソースと呼び、ソースごとにサブフォルダを作ります。コピーには短い ASCII のファイル名を付けます。元の画像を移動・削除しても、背景は引き続き表示されます。

- ファイルやフォルダから追加した画像は、ソースを追加したときにコピーします。元の場所は、ソースの詳細に **インポート元** として表示されます。
- ファイルやフォルダのソースに画像を追加するには、詳細の **画像を追加** を押すか、**フォルダを開く** で開いたサブフォルダに画像を入れます。URL の画像を更新するには **再ダウンロード** を使います。再インポートや再ダウンロードで、そのソースのサブフォルダにある画像が置き換わります。
- 保存先を変えるには、ビューの **画像フォルダ** にある **変更** を押すか、`ushiroe.libraryFolder` を設定します。**既定に戻す** を押すと既定のフォルダに戻ります。新しい保存先では、元のパスや URL からソースをインポートし直します。ソースに直接追加した画像と、変更した画像の並び順は、以前のフォルダに残ります。
- サブフォルダから画像を削除すると、背景にも表示されなくなります。ソース自体を削除すると、`manifest.json` があるサブフォルダは、手動で追加した画像も含めて削除されます。
:::

:::kiritan{locale=en}
## Presets and image rotation

Under **Image** for each area, select a source, a preset, or **All images**. In the view, each source's rotation controls appear in its details once it has at least two images.

- **Order**: from top to bottom, or random.
- **Switch interval**: Time in seconds between images. Set it to `0` to turn off timed rotation.
- **Switch only at VS Code startup**: Advance to the next image or choose one at random when VS Code starts.

A preset is an ordered list of images you choose. Click **New Preset**, give it a name, and select the images under **Add Images**. Use the arrows to reorder them. You can create as many presets as you like.

In sequential mode, **All images** follows the order of sources in the **Images** list, then the order of images within each source. Use the arrows to change either order. A source and **All images** each show up to 2,000 images.
:::
:::kiritan{locale=ja}
## プリセットと画像の切り替え

各エリアの **画像** には、ソース、プリセット、**すべての画像** を選べます。画像が 2 枚以上あるソースでは、詳細を開くと切り替え方を設定できます。

- **順番**：上から順に表示するか、ランダムに選びます。
- **切り替え間隔**：次の画像に切り替えるまでの秒数です。`0` にするとタイマーをオフにします。
- **VS Code の起動時だけ切り替える**：起動するたびに次の画像、またはランダムに選んだ画像を表示します。

プリセットは好きな画像を並べたリストです。**新規プリセット** を押して名前を付け、**画像を追加** から使いたい画像を選びます。矢印で画像の順番を変えられます。プリセットはいくつでも作れます。

**すべての画像** を上から順に表示する場合は、**画像** 一覧のソース順に切り替わります。各ソースの中では、詳細に表示される順番で切り替わります。ソースも画像も矢印で並べ替えられます。各ソースと **すべての画像** で表示できるのは、それぞれ最大 2,000 枚です。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## 設定

| 設定 | 説明 |
| --- | --- |
| `ushiroe.enabled` | 背景画像を表示します。 |
| `ushiroe.mode` | `fullscreen` はウィンドウ全体に 1 枚、`parts` はエリアごとに別の画像を表示します。 |
| `ushiroe.sources` | 画像ソースです。種類は `file`、`folder`、`url` です。切り替え方は `random`、`interval`（秒）、`changeOnStartupOnly` で設定します。フォルダでは `recursive`、URL では `refresh`（`never` または `startup`）も指定できます。 |
| `ushiroe.fullscreen` | ウィンドウ全体の画像、不透明度、フィット、位置、ぼかしです。画像にはソースの ID、すべての画像を表す `*`、プリセットを表す `preset:<id>` を指定できます。 |
| `ushiroe.editor`、`ushiroe.sidebar`、`ushiroe.auxiliaryBar`、`ushiroe.panel` | 各エリアの背景設定です。`enabled` で表示を切り替えます。 |
| `ushiroe.transition` | 画像を切り替えるときのクロスフェードの秒数です。 |
| `ushiroe.allImages` | すべての画像（`*`）の切り替え設定です。`random`、`interval`（秒）、`changeOnStartupOnly` を設定します。 |
| `ushiroe.presets` | 作成したプリセットです。名前、画像の並び順、切り替え方を設定します。 |
| `ushiroe.libraryFolder` | 画像のコピーを置くフォルダです。空にするとピクチャフォルダ内の `UshiroE` を使います。 |
| `ushiroe.backImage.priority` | BackImage の動作中にどちらの拡張機能が背景を管理するかを選びます。値は `ushiroe`（既定）または `backImage` です。 |
| `ushiroe.patch.hideCorruptWarning` | パッチ適用時に検証済みのワークベンチファイルのチェックサムを更新し、整合性チェックの警告を抑えます。 |
| `ushiroe.patch.autoRepair` | 背景がオンなら、起動時にパッチが消えていたり古くなっていたりすると、自動で適用し直します。 |

対応画像形式：PNG、JPEG、GIF、BMP、SVG、WebP。

**設定をエクスポート** は、画像ソースのパスやプリセットの参照先など、背景の設定を保存します。別の端末へ移行する場合は、画像ファイルと画像フォルダも別に保管してください。画像フォルダの保存先とパッチの設定は、移行先で設定します。
:::

:::kiritan{locale=en}
## How it works

UshiroE adds a small script to `workbench.desktop.main.js` in the VS Code installation folder. The script reads UshiroE's settings from its global storage folder every few seconds, so most changes apply without a restart. VS Code caches the workbench script until it quits, so changes to the patch require you to quit and reopen VS Code.

If VS Code is installed in a folder you cannot write to, UshiroE asks for administrator rights once.
:::
:::kiritan{locale=ja}
## 仕組み

UshiroE は、VS Code のインストールフォルダにある `workbench.desktop.main.js` にスクリプトを追加します。このスクリプトが拡張機能のグローバルストレージから数秒ごとに設定を読み込むため、画像や表示設定は再起動なしで反映されます。パッチを更新したときは、ワークベンチスクリプトのキャッシュを更新するために、VS Code を終了して開き直してください。

VS Code のインストールフォルダに書き込む権限がない場合は、管理者権限を求めます。
:::

:::kiritan{locale=en}
## Uninstalling

Run **UshiroE: Remove Patch from VS Code** before uninstalling, then restart VS Code. UshiroE's uninstall hook also attempts to remove the patch. If the patch is still there when you reinstall UshiroE, the extension asks whether to remove it.
:::
:::kiritan{locale=ja}
## アンインストール

アンインストール前に **UshiroE: VS Code からパッチを削除** を実行し、VS Code を再起動してください。アンインストール時の復旧処理でもパッチの削除を試みます。再インストール時にパッチが残っていたら、削除するか確認します。
:::

:::kiritan{locale=en}
## Notes

- Patching can trigger VS Code's integrity warning. The `ushiroe.patch.hideCorruptWarning` setting is on by default and updates the checksum when UshiroE applies the patch.
- UshiroE only works in desktop VS Code. In remote sessions (SSH, WSL, Dev Containers) it runs on your local machine, and images must be on your local machine.
- If something goes wrong, see [Troubleshooting](#troubleshooting).
:::
:::kiritan{locale=ja}
## 注意事項

- パッチを適用すると、VS Code の整合性チェックで警告が出ることがあります。既定でオンの `ushiroe.patch.hideCorruptWarning` は、パッチ適用時にチェックサムを更新してこの警告を抑えます。
- UshiroE はデスクトップ版の VS Code で動作します。SSH、WSL、Dev Containers で接続している場合も、画像はローカルの端末に置いてください。
- 問題が起きたときは [トラブルシューティング](#トラブルシューティング) を見てください。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## トラブルシューティング

UshiroE は、複数のウィンドウで同時にパッチを適用しないようロックを使います。ワークベンチスクリプトの状態を確認してから、ファイルをアトミックに書き換え、結果を検証します。BackImage が動作中は VS Code のファイルを変更しません。自動修復を試すのは VS Code のビルドごとに 1 回までです。**UshiroE: パッチを修復** を実行すると、回数の制限がリセットされます。UshiroE が自動で VS Code を再読み込みしたり再起動したりすることはありません。

**「インストールが壊れている可能性があります」と出る、またはウィンドウが再読み込みを繰り返す**

1. BackImage など、VS Code にパッチを適用するほかの拡張機能をアンインストールします。BackImage の場合は `code --uninstall-extension robotofficial.backimage` を使えます。
2. **UshiroE: VS Code のワークベンチを復元** を実行します。バックアップを検証できれば復元します。バックアップが使えない場合は、ワークベンチファイルを検証できれば UshiroE のパッチを取り除きます。
3. VS Code を再起動します。

**VS Code が起動しない**

Node.js で UshiroE の復旧スクリプトを実行します。引数に VS Code のインストールフォルダを指定してください。Windows では通常 `%LOCALAPPDATA%\Programs\Microsoft VS Code` です。

```sh
node ~/.vscode/extensions/otoneko1102.ushiroe-<version>/dist/uninstall.js "<VS Code のインストールフォルダ>"
```

保存したワークベンチスクリプトのチェックサムが記録と一致すれば、そのコピーを復元します。一致しない場合は、パッチを取り除いた状態のスクリプトを検証できれば、UshiroE のパッチだけを削除します。検証できない場合は VS Code を再インストールしてください。すべてのユーザー向けに VS Code をインストールした場合は、管理者としてスクリプトを実行してください。
:::

:::kiritan{locale=en}
## Known issues

**VS Code signed you out of GitHub.** Sign in again. On Windows, VS Code 1.146 stores GitHub credentials in `~/.vscode-shared/sharedStorage/state.vscdb`, which VS Code instances under the same Windows account share. An instance with a different `--user-data-dir` can delete credentials it cannot decrypt. Keep `~/.vscode-shared`: it also stores Workspace Trust and recent folders. UshiroE does not access this folder. See the [investigation](docs/investigations/github-signout.md).
:::
:::kiritan{locale=ja}
## 既知の問題

**VS Code で GitHub からサインアウトされた。** もう一度サインインしてください。Windows 版の VS Code 1.146 では、同じ Windows アカウントで起動した VS Code が `~/.vscode-shared/sharedStorage/state.vscdb` を共有しています。別の `--user-data-dir` で VS Code を起動すると、復号できない認証情報が削除されることがあります。`~/.vscode-shared` にはワークスペースの信頼設定や最近開いたフォルダも保存されているので、削除しないでください。UshiroE はこのフォルダにアクセスしません。詳しくは [調査結果](docs/investigations/github-signout.md) を参照してください。
:::

:::kiritan{locale=en}
## Contributing

See the [contributing guide](CONTRIBUTING.md) for build, test, and release instructions.
:::
:::kiritan{locale=ja}
## 開発に参加する

ビルド、テスト、リリースの手順は [コントリビューションガイド](CONTRIBUTING.ja.md) を参照してください。
:::

:::kiritan{locale=en}
## License

[MIT](LICENSE)
:::
:::kiritan{locale=ja}
## ライセンス

[MIT](LICENSE)
:::
