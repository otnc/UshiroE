<p align="center">
  <img src="https://raw.githubusercontent.com/otnc/UshiroE/main/resources/icon.png" alt="UshiroE icon" width="128" height="128">
</p>

# UshiroE

:::kiritan{locale=en}
UshiroE (後ろ絵, "the picture behind") puts background images behind VS Code: one image over the whole window, or separate images for the editor, the side bars and the panel. It is the successor to [BackImage](https://github.com/ro80t/BackImage), rebuilt for current versions of VS Code, and it can import your BackImage settings.
:::
:::kiritan{locale=ja}
UshiroE (後ろ絵) は、VS Code の背景に画像を表示する拡張機能です。ウィンドウ全体に 1 枚の画像を表示することも、エディター、サイドバー、パネルに別々の画像を表示することもできます。[BackImage](https://github.com/ro80t/BackImage) の後継として最新の VS Code 向けに作り直したもので、BackImage の設定をそのままインポートできます。
:::

:::kiritan{locale=en}
## Features

- **Full window or per part**: the editor, the primary side bar, the secondary side bar (where Chat lives) and the panel can each have their own image.
- **Live updates**: changing an image, the opacity, the fit or the blur takes effect within a couple of seconds. No reload is needed, apart from a single restart when the patch is first installed.
- **Folders and URLs**: a folder rotates through its images at a fixed interval, in order or at random, optionally including subfolders. New files in the folder are picked up automatically. `https://` image URLs work too.
- **Fit, position and blur** per area, and a cross-fade when images change.
- **Next Image** command to skip to the next image right away.
- **Import from BackImage**, plus export and import of UshiroE's own settings as JSON.
- **Safe patching**: no full copies of VS Code's files are kept. The patch is a marked block that is removed exactly, so restoring never brings back a stale file from an older VS Code version.
- **Survives updates**: after VS Code updates, the patch is re-applied automatically.
:::
:::kiritan{locale=ja}
## 機能

- **ウィンドウ全体またはパーツごと**: エディター、プライマリ サイドバー、セカンダリ サイドバー (チャットがある側)、パネルにそれぞれ別の画像を設定できます。
- **即時反映**: 画像、不透明度、サイズ、ぼかしを変えると数秒以内に反映されます。パッチを初めて適用したときに 1 回再起動するだけで、それ以降の再読み込みは不要です。
- **フォルダと URL**: フォルダを指定すると、中の画像を一定間隔で順番またはランダムに切り替えます。サブフォルダを含めることもできます。フォルダに追加した画像は自動で反映されます。`https://` の画像 URL も使えます。
- エリアごとの **サイズ、位置、ぼかし** の設定と、画像切り替え時のクロスフェード。
- すぐに次の画像へ切り替える **次の画像** コマンド。
- **BackImage からのインポート** と、UshiroE の設定の JSON でのエクスポートとインポート。
- **安全なパッチ**: VS Code のファイルを丸ごとバックアップすることはしません。パッチは目印付きのブロックとして追加し、削除するときはそのブロックだけを取り除きます。そのため、古いバージョンのファイルで VS Code を上書きしてしまうことがありません。
- **アップデートに追従**: VS Code が更新されると、パッチを自動で再適用します。
:::

:::kiritan{locale=en}
## Getting started

1. Open the UshiroE view from the activity bar.
2. Add an image with **File**, **Folder** or **URL**.
3. Choose the image for the full window, or switch the mode to **Per part** and pick images for the parts you want.
4. Press **Turn On**. The first time, UshiroE asks for permission to patch VS Code. Restart VS Code once (quit it and open it again) and the background appears.

After that, changes in the view or in `settings.json` show up without restarting.
:::
:::kiritan{locale=ja}
## 使い方

1. アクティビティバーから UshiroE のビューを開きます。
2. **ファイル**、**フォルダ**、**URL** のいずれかで画像を追加します。
3. ウィンドウ全体に表示する画像を選びます。パーツごとに設定したい場合は、モードを **パーツごと** に切り替えて、各パーツの画像を選びます。
4. **オンにする** を押します。初回は VS Code へのパッチ適用の確認が出ます。VS Code を 1 回再起動 (終了してから開き直す) すると背景が表示されます。

それ以降は、ビューや `settings.json` での変更が再起動なしで反映されます。
:::

:::kiritan{locale=en}
## Moving from BackImage

1. Install UshiroE. If BackImage is installed, UshiroE offers to import its settings. You can also run **UshiroE: Import Settings from BackImage** from the Command Palette at any time.
2. After the import, UshiroE offers to uninstall BackImage. Accept it, because both extensions patch the same file and would conflict. UshiroE also removes BackImage's patch and the `.backup` files it left in VS Code's installation folder.
3. Restart VS Code.

Image lists become image sources, and the selected images, part settings, random order and intervals carry over. BackImage's full-screen opacity described how opaque the UI was, while UshiroE's describes how visible the image is, so that value is converted (BackImage's 0.85 becomes 0.15). Like BackImage, backgrounds stay off when no background type was selected in BackImage.
:::
:::kiritan{locale=ja}
## BackImage からの移行

1. UshiroE をインストールします。BackImage が入っていれば、設定をインポートするか確認されます。コマンドパレットの **UshiroE: BackImage から設定をインポート** からもいつでも実行できます。
2. インポートが終わると、BackImage をアンインストールするか確認されます。2 つの拡張機能は同じファイルにパッチを当てて競合するので、アンインストールしてください。このとき、BackImage が VS Code のインストールフォルダに残したパッチと `.backup` ファイルも UshiroE が削除します。
3. VS Code を再起動します。

画像リストは画像ソースになり、選んでいた画像、パーツの設定、ランダム表示、切り替え間隔も引き継がれます。BackImage のフルスクリーンの透明度は UI の不透明度を表していましたが、UshiroE では画像の見えやすさを表すので、値を変換します (BackImage の 0.85 は 0.15 になります)。BackImage で背景の種類を選んでいなかった場合は、BackImage と同じく背景はオフのままです。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## 設定

| 設定 | 説明 |
| --- | --- |
| `ushiroe.enabled` | 背景画像を表示します。 |
| `ushiroe.mode` | `fullscreen` はウィンドウ全体に 1 枚、`parts` はパーツごとに別の画像を表示します。 |
| `ushiroe.sources` | 画像ソースです。`file`、`folder`、`url` を指定でき、フォルダには `random`、`interval` (秒)、`recursive` も設定できます。 |
| `ushiroe.fullscreen` | ウィンドウ全体の画像、不透明度、サイズ、位置、ぼかしです。 |
| `ushiroe.editor`、`ushiroe.sidebar`、`ushiroe.auxiliaryBar`、`ushiroe.panel` | 各パーツの同様の設定です。`enabled` も含みます。 |
| `ushiroe.transition` | 画像を切り替えるときのクロスフェードの秒数です。 |
| `ushiroe.patch.hideCorruptWarning` | VS Code のチェックサムを更新し、「インストールが壊れている」という警告を出さないようにします。 |
| `ushiroe.patch.autoRepair` | VS Code の更新後にパッチを自動で再適用します。 |

対応している画像形式は PNG、JPEG、GIF、BMP、SVG、WebP です。VS Code がディスク上の任意のフォルダから読み込める形式がこれらに限られているためです。
:::

:::kiritan{locale=en}
## How it works

VS Code has no API for changing its own appearance, so UshiroE appends a small script to `workbench.desktop.main.js` in VS Code's installation folder. The script reads a settings file that UshiroE keeps in its global storage folder and checks it every couple of seconds, which is why most changes apply without a restart. Changing the patch itself needs a full restart, because VS Code keeps the workbench script cached until it quits.

If VS Code is installed in a folder you cannot write to, UshiroE asks for administrator rights once.
:::
:::kiritan{locale=ja}
## 仕組み

VS Code には見た目を変えるための API がないため、UshiroE は VS Code のインストールフォルダにある `workbench.desktop.main.js` に小さなスクリプトを追加します。このスクリプトは UshiroE がグローバルストレージに保存する設定ファイルを数秒ごとに読み込むので、ほとんどの変更は再起動なしで反映されます。パッチ自体を変更したときは、VS Code が終了するまでワークベンチのスクリプトをキャッシュしているため、完全な再起動が必要です。

VS Code が書き込み権限のないフォルダにインストールされている場合は、1 回だけ管理者権限を求めます。
:::

:::kiritan{locale=en}
## Uninstalling

Run **UshiroE: Remove Patch from VS Code** before uninstalling, then restart VS Code. If you forget, UshiroE's uninstall hook removes the patch the next time VS Code starts after the uninstall.
:::
:::kiritan{locale=ja}
## アンインストール

アンインストールする前に **UshiroE: VS Code からパッチを削除** を実行し、VS Code を再起動してください。忘れた場合でも、アンインストール後に VS Code を次に起動したときに UshiroE のアンインストール処理がパッチを削除します。
:::

:::kiritan{locale=en}
## Notes

- VS Code may show "[Unsupported]" in the title bar or a notice that the installation is corrupt. `ushiroe.patch.hideCorruptWarning` (on by default) updates VS Code's checksum to prevent this.
- UshiroE only works in desktop VS Code. In remote sessions (SSH, WSL, Dev Containers) it runs on your local machine, and images must be on your local machine.
- If something goes wrong, run **UshiroE: Remove Patch from VS Code**. Reinstalling VS Code also restores it completely.
:::
:::kiritan{locale=ja}
## 注意事項

- VS Code のタイトルバーに「[サポート対象外]」と表示されたり、インストールが壊れているという通知が出たりすることがあります。`ushiroe.patch.hideCorruptWarning` (既定でオン) は VS Code のチェックサムを更新してこれを防ぎます。
- UshiroE はデスクトップ版の VS Code でのみ動作します。リモート (SSH、WSL、Dev Containers) でもローカルのマシンで動くので、画像はローカルのマシンに置いてください。
- 問題が起きたときは **UshiroE: VS Code からパッチを削除** を実行してください。VS Code を再インストールしても完全に元に戻ります。
:::

:::kiritan{locale=en}
## License

[MIT](LICENSE)
:::
:::kiritan{locale=ja}
## ライセンス

[MIT](LICENSE)
:::
