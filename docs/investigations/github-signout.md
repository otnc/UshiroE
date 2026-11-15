# GitHub sign-out on 2026-11-15

## Summary

During manual testing on Windows, a VS Code test instance launched with a separate `--user-data-dir` could not decrypt the GitHub credentials in shared storage and deleted them. UshiroE does not access VS Code's secrets or shared storage. A unit test checks that boundary.

## Mechanism (VS Code 1.146.0, commit `69047191fc427f2f92828279aae1d90d8eeda7ab`)

1. On Windows, the GitHub token is a cross-app shared secret stored in `APPLICATION_SHARED` scope, that is in `~/.vscode-shared/sharedStorage/state.vscdb`: [`CROSS_APP_SHARED_SECRET_KEYS` and `useSharedStorage`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/secrets/common/secrets.ts#L78-L124).
2. The shared storage folder comes from `appSharedDataHome` and does not depend on `--user-data-dir`. It is only in memory while extension tests run (`extensionTestsLocationURI` is set): [`createApplicationSharedStorage`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/storage/electron-main/storageMainService.ts#L198-L210), [`getStorageOptions`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/storage/electron-main/storageMainService.ts#L107-L111).
3. Secrets are encrypted with Electron `safeStorage`. On Windows its key lives in the user data folder's `Local State`, so every user data folder has its own key: [`EncryptionMainService.decrypt`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/encryption/electron-main/encryptionMainService.ts#L46-L62).
4. When decryption fails, `BaseSecretStorageService.get()` deletes the secret from the scope it was read from, here the shared storage: [`get`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/secrets/common/secrets.ts#L139-L160), [`removeValueFromStorage`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/platform/secrets/common/secrets.ts#L211-L214).

On the same Windows account, the test instance read the shared `github.auth` credential. Its user data folder had a different encryption key, so VS Code could not decrypt the credential and deleted it.

## Evidence

- The manual test instances (separate `--user-data-dir`, started between 19:55 and 20:06) logged `[shared storage] Creating shared storage database at 'c:\Users\<user>\.vscode-shared\sharedStorage\state.vscdb'` in `main.log`.
- Their `GitHub Authentication` log shows `Reading sessions from keychain...` with no `Got stored sessions!` afterwards, from 19:55:39 on. This is the same pattern the user's own VS Code showed at 20:12:26.
- The long-running user window still listed 4 sessions at 20:12:02 because the GitHub extension keeps sessions in memory; the token was only read again after the restart at 20:12:11.
- Microsoft account secrets survived because they live in the per-user-data `APPLICATION` storage, which the test instances did not share.
- `IntegrityService` only decides whether to show the "installation appears to be corrupt" notice and stores a "don't show again" flag; nothing in it relates to secrets or the shared storage: [`integrityService.ts`](https://github.com/microsoft/vscode/blob/69047191fc427f2f92828279aae1d90d8eeda7ab/src/vs/workbench/services/integrity/electron-browser/integrityService.ts).
- The `@vscode/test-cli` integration tests used `':memory:'` and are not involved; an integration test now fails if that ever changes.

## Reproduction matrix

These six cases (rewritten `product.json`, patch with and without `hideCorruptWarning`, mismatched checksum, reload storms, UshiroE with BackImage 1.1.6) were **not run**. They must run on a separate Windows account or a VM, because the shared storage is per OS user and a test on the developer's account can sign them out again. The source and logs explain the observed sign-out. These cases still need to run before release to check for other causes.

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

- For development, follow the [test instructions in the contributing guide](../../CONTRIBUTING.md#development).
- An integration test checks that the test instance opens its shared database in memory (`:memory:`).
- A unit test fails when `src/` mentions `.vscode-shared` or the secrets API.
- The workbench safeguards address a separate issue: VS Code can show a corrupt installation warning or repeatedly reload when extensions overwrite each other's patches. UshiroE skips writes while BackImage is active, locks and verifies workbench updates, and limits automatic repair attempts.
