:::kiritan{locale=en}
# Contributing to UshiroE
:::
:::kiritan{locale=ja}
# UshiroE の開発に参加する
:::

:::kiritan{locale=en}
## Development

Install dependencies with `npm ci` using Node.js 22, as in CI.

| Command | What it does |
| --- | --- |
| `npm run build` | Bundles the extension into `dist/`. |
| `npm run check-types`, `npm run lint`, `npm run format:check` | Type checks, lints and checks formatting. |
| `npm test` | Runs the unit tests. |
| `npm run test:integration` | Runs the integration tests in a downloaded VS Code. |
| `npm run vsix` | Builds `ushiroe.vsix`. |
| `npm run vsix:install` | Builds `ushiroe.vsix` and installs it into your VS Code with `code --install-extension`. |
| `npm run docs:build` | Regenerates the English and Japanese README and contributing guides from `base/*.base.md`. |
| `npm run docs:check`, `npx kiritan verify` | Check translations and verify that generated docs match their sources. |
| `npm run changelog:preview` | Shows the changelog entry the next release will get. |

Releases are made with the `release` workflow. `CHANGELOG.md` is generated from Conventional Commits by git-cliff, so PR titles must follow that format (`feat: ...`, `fix: ...`). Squash merges use the PR title as the commit message.

> [!WARNING]
> Never launch a test instance with a separate `--user-data-dir` under your usual Windows account. It shares storage with your regular VS Code instance and can sign you out of GitHub. See [Known issues](README.md#known-issues). Use `npm run test:integration`, which uses in-memory storage, or test in a separate Windows account or VM.
:::
:::kiritan{locale=ja}
## 開発

CI と同じ Node.js 22 を使い、`npm ci` で依存関係をインストールします。

| コマンド | 内容 |
| --- | --- |
| `npm run build` | 拡張機能を `dist/` にバンドルします。 |
| `npm run check-types`、`npm run lint`、`npm run format:check` | 型チェック、lint、フォーマットのチェックを行います。 |
| `npm test` | ユニットテストを実行します。 |
| `npm run test:integration` | ダウンロードした VS Code で統合テストを実行します。 |
| `npm run vsix` | `ushiroe.vsix` を作ります。 |
| `npm run vsix:install` | `ushiroe.vsix` を作り、`code --install-extension` で VS Code にインストールします。 |
| `npm run docs:build` | `base/*.base.md` から日英の README とコントリビューションガイドを生成します。 |
| `npm run docs:check`、`npx kiritan verify` | 翻訳と、生成ファイルが原稿と一致しているかを確認します。 |
| `npm run changelog:preview` | 次のリリースで追加される変更履歴を表示します。 |

リリースは `release` ワークフローで行います。`CHANGELOG.md` は git-cliff が Conventional Commits から生成するので、PR のタイトルはその形式（`feat: ...`、`fix: ...`）にしてください。スカッシュマージでは、PR のタイトルがコミットメッセージになります。

> [!WARNING]
> 普段使っている Windows アカウントで、別の `--user-data-dir` を指定してテスト用の VS Code を起動しないでください。ストレージを共有するため、GitHub からサインアウトされることがあります。[既知の問題](README.ja.md#既知の問題) を参照してください。テストにはメモリ内ストレージを使う `npm run test:integration`、別の Windows アカウント、または VM を使ってください。
:::
