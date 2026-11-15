**English** | [日本語](CONTRIBUTING.ja.md)

# Contributing to UshiroE

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
