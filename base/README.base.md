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
- **Folders and URLs**: a folder's images rotate at a fixed interval, in order or at random, optionally including subfolders. Images from `http://` and `https://` URLs are downloaded once or again at every startup.
- **One image folder**: every image is copied into `UshiroE` in your Pictures folder (or a folder you choose) under a short ASCII name when you add it, so paths with Japanese or other non-ASCII characters never cause trouble, and the background stays when the original is moved or deleted.
- **Random everything**: show all images in random order, save layouts as presets, and apply a random preset on demand or at every startup.
- **Fit, position and blur** per area, and a cross-fade when images change. The title bar with the menus always stays clear.
- **Next Image** command to skip to the next image right away.
- **Import from BackImage**, plus export and import of UshiroE's own settings as JSON.
- **Safe patching**: no full copies of VS Code's files are kept. The patch is a marked block that is removed exactly, so restoring never brings back a stale file from an older VS Code version.
- **Survives updates**: after VS Code updates, the patch is re-applied automatically.
:::
:::kiritan{locale=ja}
## 機能

- **ウィンドウ全体またはパーツごと**: エディター、プライマリ サイドバー、セカンダリ サイドバー (チャットがある側)、パネルにそれぞれ別の画像を設定できます。
- **即時反映**: 画像、不透明度、サイズ、ぼかしを変えると数秒以内に反映されます。パッチを初めて適用したときに 1 回再起動するだけで、それ以降の再読み込みは不要です。
- **フォルダと URL**: フォルダを指定すると、中の画像を一定間隔で順番またはランダムに切り替えます。サブフォルダを含めることもできます。`http://` と `https://` の URL の画像は、1 回だけ、または起動するたびにダウンロードします。
- **画像フォルダに集約**: すべての画像をピクチャフォルダ内の `UshiroE` (または選んだフォルダ) に、追加したときに ASCII の短い名前でコピーします。日本語などを含むパスでも問題が起きず、元の画像を移動したり削除したりしても背景は消えません。
- **ランダム**: すべての画像をランダムに表示したり、レイアウトをプリセットとして保存して、ランダムなプリセットを好きなときや起動時に適用したりできます。
- エリアごとの **サイズ、位置、ぼかし** の設定と、画像切り替え時のクロスフェード。メニューのあるタイトルバーには画像を重ねません。
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
2. After the import, UshiroE offers to uninstall BackImage. Accept it, because both extensions patch the same file and would conflict.
3. Restart VS Code. BackImage keeps running until then, so UshiroE changes nothing before the restart. After it, UshiroE asks to delete the `.backup` files BackImage left in VS Code's installation folder and applies its patch.

While BackImage is active, UshiroE never writes VS Code's files. `ushiroe.backImage.priority` decides what happens then:

- `ushiroe` (default): UshiroE shows a warning with **Uninstall BackImage**, **Disable BackImage** and **Let BackImage Take Over**.
- `backImage`: BackImage manages the background and UshiroE stays out of the way, including its automatic repair. Once BackImage is gone, UshiroE takes over again.

Image lists become image sources, and the selected images, part settings, random order and intervals carry over. BackImage's full-screen opacity described how opaque the UI was, while UshiroE's describes how visible the image is, so that value is converted (BackImage's 0.85 becomes 0.15). Like BackImage, backgrounds stay off when no background type was selected in BackImage. Imported images are copied into the image folder like any other image.
:::
:::kiritan{locale=ja}
## BackImage からの移行

1. UshiroE をインストールします。BackImage が入っていれば、設定をインポートするか確認されます。コマンドパレットの **UshiroE: BackImage から設定をインポート** からもいつでも実行できます。
2. インポートが終わると、BackImage をアンインストールするか確認されます。2 つの拡張機能は同じファイルにパッチを当てて競合するので、アンインストールしてください。
3. VS Code を再起動します。それまでは BackImage が動き続けるので、UshiroE は再起動前には何も変更しません。再起動後に、BackImage が VS Code のインストールフォルダに残した `.backup` ファイルを削除するか確認してから、パッチを適用します。

BackImage が動いている間、UshiroE は VS Code のファイルを一切書き換えません。そのときの動きは `ushiroe.backImage.priority` で決まります。

- `ushiroe` (既定): **BackImage をアンインストール**、**BackImage を無効化**、**BackImage に任せる** のボタン付きで警告を出します。
- `backImage`: BackImage が背景を管理し、UshiroE は自動修復も含めて何もしません。BackImage がいなくなると、UshiroE がまた管理します。

画像リストは画像ソースになり、選んでいた画像、パーツの設定、ランダム表示、切り替え間隔も引き継がれます。BackImage のフルスクリーンの透明度は UI の不透明度を表していましたが、UshiroE では画像の見えやすさを表すので、値を変換します (BackImage の 0.85 は 0.15 になります)。BackImage で背景の種類を選んでいなかった場合は、BackImage と同じく背景はオフのままです。インポートした画像も、ほかの画像と同じく画像フォルダにコピーされます。
:::

:::kiritan{locale=en}
## Image folder

UshiroE never shows your original files directly. Every image, whether it comes from a file, a folder, a URL or BackImage, is copied into `UshiroE` in your Pictures folder, with one subfolder per source and short ASCII file names. This avoids trouble with paths that contain Japanese or other non-ASCII characters, and the background keeps working when the original is moved or deleted.

- Images are copied once, when you add them. After that the source no longer depends on the original file or folder, which is only shown as "Imported from" in the source's details.
- To add images to a source, use **Add Images** in its details, or put image files into its subfolder (**Open Folder**). Deleting a file there removes it from the background.
- Use **Change** in the view's Image folder section (or `ushiroe.libraryFolder`) to pick another folder, and **Use Default** to go back. The old folder is left as it is.
- Only subfolders UshiroE created (they contain a `manifest.json`) are ever deleted, so other files you keep there are safe.
:::
:::kiritan{locale=ja}
## 画像フォルダ

UshiroE は元のファイルを直接表示しません。ファイル、フォルダ、URL、BackImage のどこから来た画像も、ピクチャフォルダ内の `UshiroE` に、ソースごとのサブフォルダと ASCII の短いファイル名でコピーします。日本語などを含むパスで問題が起きることを防ぎ、元の画像を移動したり削除したりしても背景はそのまま表示されます。

- 画像は追加したときに 1 回だけコピーします。その後は元のファイルやフォルダとつながらず、元の場所はソースの詳細に「取り込み元」として表示するだけです。
- ソースに画像を足すときは、詳細の **画像を追加** を使うか、そのソースのサブフォルダ (**フォルダを開く**) に画像ファイルを入れてください。そこからファイルを削除すると、背景からも消えます。
- ビューの「画像フォルダ」にある **変更** (または `ushiroe.libraryFolder`) で別のフォルダを選べます。**既定に戻す** で元に戻せます。それまでのフォルダはそのまま残ります。
- 削除するのは UshiroE が作ったサブフォルダ (`manifest.json` があるもの) だけなので、ほかに置いたファイルが消えることはありません。
:::

:::kiritan{locale=en}
## Random and presets

- Choose **All images (random)** as an area's image to shuffle through the images of every source. `ushiroe.shuffleInterval` sets how often it changes.
- **Save** stores the current layout (the mode and every area) as a preset. Apply or delete presets from the view or the Command Palette.
- **Random** applies a random preset, always a different one from the current layout when there is a choice. Turn on **Apply a random preset when VS Code starts** to get a new look every time.
:::
:::kiritan{locale=ja}
## ランダムとプリセット

- エリアの画像に **すべての画像 (ランダム)** を選ぶと、すべてのソースの画像をランダムに切り替えます。切り替え間隔は `ushiroe.shuffleInterval` で設定します。
- **保存** で現在のレイアウト (モードと各エリアの設定) をプリセットとして保存します。プリセットの適用と削除はビューやコマンドパレットから行えます。
- **ランダム** はランダムなプリセットを適用します。選択肢があるときは、必ず今と違うプリセットを選びます。**VS Code の起動時にランダムなプリセットを適用する** をオンにすると、起動するたびに見た目が変わります。
:::

:::kiritan{locale=en}
## Settings

| Setting | Description |
| --- | --- |
| `ushiroe.enabled` | Show background images. |
| `ushiroe.mode` | `fullscreen` for one image over the window, `parts` for separate images per part. |
| `ushiroe.sources` | Image sources: `file`, `folder` or `url`, with `random`, `interval` (seconds) and `recursive` for folders and `refresh` (`never` or `startup`) for URLs. |
| `ushiroe.fullscreen` | Image, opacity, fit, position and blur for the full window. The image is a source id, or `*` for all images. |
| `ushiroe.editor`, `ushiroe.sidebar`, `ushiroe.auxiliaryBar`, `ushiroe.panel` | The same, plus `enabled`, for each part. |
| `ushiroe.transition` | Seconds the cross-fade between images takes. |
| `ushiroe.shuffleInterval` | Seconds between images for All images (`*`); 0 changes only at startup. |
| `ushiroe.presets` | Saved layouts. |
| `ushiroe.randomPresetOnStartup` | Apply a random preset each time VS Code starts. |
| `ushiroe.libraryFolder` | Folder for the image copies; empty means `UshiroE` in your Pictures folder. |
| `ushiroe.backImage.priority` | Who manages the background while BackImage is active: `ushiroe` (default) or `backImage`. |
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
| `ushiroe.sources` | 画像ソースです。`file`、`folder`、`url` を指定できます。フォルダには `random`、`interval` (秒)、`recursive`、URL には `refresh` (`never` または `startup`) も設定できます。 |
| `ushiroe.fullscreen` | ウィンドウ全体の画像、不透明度、サイズ、位置、ぼかしです。画像にはソースの ID か、すべての画像を表す `*` を指定します。 |
| `ushiroe.editor`、`ushiroe.sidebar`、`ushiroe.auxiliaryBar`、`ushiroe.panel` | 各パーツの同様の設定です。`enabled` も含みます。 |
| `ushiroe.transition` | 画像を切り替えるときのクロスフェードの秒数です。 |
| `ushiroe.shuffleInterval` | すべての画像 (`*`) の切り替え間隔 (秒) です。0 にすると起動時にだけ切り替えます。 |
| `ushiroe.presets` | 保存したレイアウトです。 |
| `ushiroe.randomPresetOnStartup` | VS Code を起動するたびにランダムなプリセットを適用します。 |
| `ushiroe.libraryFolder` | 画像のコピーを置くフォルダです。空にするとピクチャフォルダ内の `UshiroE` を使います。 |
| `ushiroe.backImage.priority` | BackImage が動いているときに背景を管理する側です。`ushiroe` (既定) または `backImage` を指定します。 |
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

Run **UshiroE: Remove Patch from VS Code** before uninstalling, then restart VS Code. If you forget, UshiroE's uninstall hook removes the patch the next time VS Code starts after the uninstall. If the patch is still there when you install UshiroE again, UshiroE asks whether to remove it before doing anything else.
:::
:::kiritan{locale=ja}
## アンインストール

アンインストールする前に **UshiroE: VS Code からパッチを削除** を実行し、VS Code を再起動してください。忘れた場合でも、アンインストール後に VS Code を次に起動したときに UshiroE のアンインストール処理がパッチを削除します。UshiroE をもう一度インストールしたときにパッチが残っていれば、ほかの処理より先に、削除するかどうかを確認します。
:::

:::kiritan{locale=en}
## Notes

- VS Code may show "[Unsupported]" in the title bar or a notice that the installation is corrupt. `ushiroe.patch.hideCorruptWarning` (on by default) updates VS Code's checksum to prevent this.
- UshiroE only works in desktop VS Code. In remote sessions (SSH, WSL, Dev Containers) it runs on your local machine, and images must be on your local machine.
- If something goes wrong, see [Troubleshooting](#troubleshooting).
:::
:::kiritan{locale=ja}
## 注意事項

- VS Code のタイトルバーに「[サポート対象外]」と表示されたり、インストールが壊れているという通知が出たりすることがあります。`ushiroe.patch.hideCorruptWarning` (既定でオン) は VS Code のチェックサムを更新してこれを防ぎます。
- UshiroE はデスクトップ版の VS Code でのみ動作します。リモート (SSH、WSL、Dev Containers) でもローカルのマシンで動くので、画像はローカルのマシンに置いてください。
- 問題が起きたときは [トラブルシューティング](#トラブルシューティング) を見てください。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## トラブルシューティング

UshiroE が VS Code のファイルを書き換えるのは、ほかのパッチを当てる拡張機能が動いていないときだけです。すべてのウィンドウで共有するロックを取り、アトミックに書き込んで内容を確認します。書き換えるのは、VS Code 本来のファイルか UshiroE 自身が以前に当てたパッチだと確認できたファイルだけです。消えたパッチの自動修復は VS Code のバージョンごとに 1 回までで、VS Code を勝手に再読み込みしたり再起動したりはしません。

**「インストールが壊れている可能性があります」と出る、またはウィンドウが再読み込みを繰り返す**

1. BackImage など、VS Code にパッチを当てるほかの拡張機能をアンインストールします: `code --uninstall-extension robotofficial.backimage`
2. **UshiroE: VS Code の Workbench を復元** を実行します。UshiroE が最初にパッチを当てる前に保存した VS Code のファイルと、VS Code 本来のチェックサムを書き戻します。
3. VS Code を再起動します。

**VS Code が起動しない**

Node.js で UshiroE の復旧スクリプトを実行します。引数には VS Code のインストールフォルダ (Windows では通常 `%LOCALAPPDATA%\Programs\Microsoft VS Code`) を渡します。

```sh
node ~/.vscode/extensions/otoneko1102.ushiroe-<version>/dist/uninstall.js "<VS Code のインストールフォルダ>"
```

ハッシュが一致すれば保存したコピーを書き戻し、一致しなければ UshiroE のパッチを取り除きます。ほかの何かがファイルを変更していた場合は、VS Code の再インストールを案内します。すべてのユーザー向けにインストールした VS Code では、管理者として実行してください。最後の手段は VS Code の再インストールで、これで必ず元に戻ります。
:::

:::kiritan{locale=en}
## Known issues

**GitHub or another sign-in is gone.** Sign in again. Since VS Code 1.146, the GitHub token is stored in `~/.vscode-shared/sharedStorage/state.vscdb`, which every VS Code on your OS account shares. Starting a second VS Code with its own `--user-data-dir` (for example a portable copy or a test instance) deletes that token, because VS Code removes secrets it cannot decrypt. Do not delete `~/.vscode-shared` to fix sign-in problems; it also holds Workspace Trust and recent folders. UshiroE never reads or writes this folder. See [the investigation](docs/investigations/github-signout.md).
:::
:::kiritan{locale=ja}
## 既知の問題

**GitHub などのサインインが消えた。** もう一度サインインしてください。VS Code 1.146 以降、GitHub のトークンは OS のアカウント内のすべての VS Code で共有される `~/.vscode-shared/sharedStorage/state.vscdb` に保存されています。別の `--user-data-dir` を使う VS Code (ポータブル版やテスト用のインスタンスなど) を起動すると、VS Code は復号できない秘密情報を削除するため、このトークンが消えます。サインインの問題を直すために `~/.vscode-shared` を削除しないでください。ワークスペースの信頼や最近開いたフォルダもここに保存されています。UshiroE はこのフォルダを読み書きしません。詳しくは [調査結果](docs/investigations/github-signout.md) を見てください。
:::

:::kiritan{locale=en}
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
:::
:::kiritan{locale=ja}
## 開発

| コマンド | 内容 |
| --- | --- |
| `npm run build` | 拡張機能を `dist/` にバンドルします。 |
| `npm run check-types`、`npm run lint`、`npm run format:check` | 型チェック、lint、フォーマットのチェックを行います。 |
| `npm test` | ユニットテストを実行します。 |
| `npm run test:integration` | ダウンロードした VS Code で統合テストを実行します。 |
| `npm run vsix` | `ushiroe.vsix` を作ります。 |
| `npm run vsix:install` | `ushiroe.vsix` を作り、`code --install-extension` で VS Code にインストールします。 |
| `npm run docs:build` | `base/README.base.md` から `README.md` と `README.ja.md` を生成し直します。 |
| `npm run changelog:preview` | 次のリリースで追加される変更履歴を表示します。 |

リリースは `release` ワークフローで行います。`CHANGELOG.md` は git-cliff が Conventional Commits から生成するので、PR のタイトルはその形式 (`feat: ...`、`fix: ...`) にしてください。PR のタイトルがそのまま squash コミットのメッセージになります。

> [!WARNING]
> UshiroE を試すために、自分の OS アカウントで別の `--user-data-dir` を使う VS Code を起動しないでください。普段の VS Code と `~/.vscode-shared` を共有するため、GitHub のサインインが消えます ([既知の問題](#既知の問題) を参照)。メモリ上のストレージで動く `npm run test:integration` を使うか、別の OS アカウントや VM で試してください。
:::

:::kiritan{locale=en}
## License

[MIT](LICENSE)
:::
:::kiritan{locale=ja}
## ライセンス

[MIT](LICENSE)
:::
