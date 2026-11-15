<!-- English or Japanese is fine. The PR title becomes the squash commit and the changelog entry, so write it as a Conventional Commit: "feat: ...", "fix: ...", "refactor: ...". -->

## Summary

<!-- Describe what changed and why. If the PR closes an issue, link it: "Closes #123" -->

## Test plan

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run check-types`
- [ ] `npm test`
- [ ] `npm run test:integration` (if the change touches activation, patching or rendering)
- [ ] Checked in VS Code with `npm run vsix:install` (if the change is visible in the window)
