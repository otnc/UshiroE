[English](CONTRIBUTING.md) | **日本語**

# UshiroE の開発に参加する

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
