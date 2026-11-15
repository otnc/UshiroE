# GitHub sign-out on 2026-11-15

## Summary

The GitHub sign-in was deleted by VS Code itself, triggered by test instances of VS Code that were started on the same Windows account with a separate `--user-data-dir` during manual end-to-end checks of UshiroE. It was not caused by UshiroE's code, by the patched workbench, or by the "impure" install state. No UshiroE code path touches secrets or the shared storage, and a unit test now keeps it that way.

## Mechanism (VS Code 1.146.0, commit `69047191fc427f2f92828279aae1d90d8eeda7ab`)

1. On Windows, the GitHub token is a cross-app shared secret stored in `APPLICATION_SHARED` scope, that is in `~/.vscode-shared/sharedStorage/state.vscdb`: [`CROSS_APP_SHARED_SECRET_KEYS` and `useSharedStorage`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/secrets/common/secrets.ts#L78-L124).
2. The shared storage folder comes from `appSharedDataHome` and does not depend on `--user-data-dir`. It is only in memory while extension tests run (`extensionTestsLocationURI` is set): [`createApplicationSharedStorage`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/storage/electron-main/storageMainService.ts#L198-L210), [`getStorageOptions`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/storage/electron-main/storageMainService.ts#L107-L111).
3. Secrets are encrypted with Electron `safeStorage`. On Windows its key lives in the user data folder's `Local State`, so every user data folder has its own key: [`EncryptionMainService.decrypt`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/encryption/electron-main/encryptionMainService.ts#L46-L62).
4. When decryption fails, `BaseSecretStorageService.get()` deletes the secret from the scope it was read from, here the shared storage: [`get`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/secrets/common/secrets.ts#L139-L160), [`removeValueFromStorage`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/secrets/common/secrets.ts#L211-L214).

So any second VS Code started with a different user data folder on the same Windows account reads the real `github.auth`, fails to decrypt it with its own key, and deletes it.

## Evidence

- The manual test instances (separate `--user-data-dir`, started between 19:55 and 20:06) logged `[shared storage] Creating shared storage database at 'c:\Users\<user>\.vscode-shared\sharedStorage\state.vscdb'` in `main.log`.
- Their `GitHub Authentication` log shows `Reading sessions from keychain...` with no `Got stored sessions!` afterwards, from 19:55:39 on. This is the same pattern the user's own VS Code showed at 20:12:26.
- The long-running user window still listed 4 sessions at 20:12:02 because the GitHub extension keeps sessions in memory; the token was only read again after the restart at 20:12:11.
- Microsoft account secrets survived because they live in the per-user-data `APPLICATION` storage, which the test instances did not share.
- `IntegrityService` only decides whether to show the "installation appears to be corrupt" notice and stores a "don't show again" flag; nothing in it relates to secrets or the shared storage: [`integrityService.ts`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/workbench/services/integrity/electron-browser/integrityService.ts).
- The `@vscode/test-cli` integration tests used `':memory:'` and are not involved; an integration test now fails if that ever changes.

## Reproduction matrix

The six cases in the task (rewritten `product.json`, patch with and without `hideCorruptWarning`, mismatched checksum, reload storms, UshiroE with BackImage 1.1.6) were **not run**. They must run on a separate Windows account or a VM, because the shared storage is per OS user and a test on the developer's account can sign them out again. The source and log evidence above already explains the sign-out without any of those cases, but running them is still required before release to rule out a second cause.

| Case | Result |
| --- | --- |
| 1. `product.json` rewritten with no change | not run |
| 2. Patch, `hideCorruptWarning: true` | not run |
| 3. Patch, `hideCorruptWarning: false` | not run |
| 4. Pristine script, mismatched checksum | not run |
| 5. Reload storm | not run |
| 6. UshiroE with BackImage 1.1.6 | not run |

For each case, record whether GitHub is still signed in and whether the `github.auth` key (key name only, never the value) is still in `~/.vscode-shared/sharedStorage/state.vscdb`, together with Workspace Trust and recent folders.

## Fixes

- Development: never start a second VS Code with its own `--user-data-dir` on your own account. Use `npm run test:integration`, a separate Windows account, or a VM. The README's Development section says so.
- An integration test fails when the test instance opens a shared storage that is not `:memory:`.
- A unit test fails when `src/` mentions `.vscode-shared` or the secrets API.
- The workbench safety work in the same change (no writes while BackImage is active, a lock, atomic and verified writes, the integrity guard, the repair limit) removes the reload loop and the corrupt notice from incident 1. None of it was needed for the sign-out, but it removes the impure-install states the task asked about.
